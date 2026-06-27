// Dashboard, matching the Android landscape/TV layout (layout-land/activity_main.xml):
// left sidebar (logo, profile, PREMIUM, Canlı/Filmler/Diziler nav, +Profil, fav/settings)
// and content rails (Film Önerileri / Dizi Önerileri / Son Eklenenler).
import { el } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { rail, type PosterItem } from '../ui/components';
import { t } from '../i18n/strings';
import { Profiles, type Profile } from '../storage/profiles';
import { Settings } from '../storage/settings';
import { XtreamClient } from '../core/api';
import { Content } from '../app/session';
import { Favorites } from '../storage/favorites';
import { History } from '../storage/history';
import { openContent } from '../app/open-content';
import { checkTrial } from '../core/trial';
import { CONFIG } from '../config/app-config';
import { isAuthed, type VodStream, type SeriesStream } from '../core/models';
import { recommendMovies, recommendSeries, isAdultContent } from '../core/recommendation';
import { nav } from '../app/nav';
import type { Screen } from '../app/router';

const DEMO = { profileName: 'Demo Mode', username: 'google_test', password: '123456', serverUrl: 'http://mock.com', isM3u: false };

const moviePoster = (m: VodStream): PosterItem => ({ id: m.stream_id, name: m.name || '', image: m.stream_icon, type: 'movie' });
const seriesPoster = (s: SeriesStream): PosterItem => ({ id: s.series_id, name: s.name || '', image: s.cover || s.stream_icon, type: 'series' });
const num = (x?: string): number => parseFloat(x || '0') || 0;
const shuffle = <T>(a: T[]): T[] => [...a].sort(() => Math.random() - 0.5);

export function homeScreen(): Screen {
  // ---- sidebar ----
  const profileName = el('div', { class: 'side-profile', text: '…' });
  const premium = el('div', { class: 'side-premium', text: t('status_premium') });
  premium.style.display = 'none';

  const navLive = navCard('live', t('title_live'), ICONS.live());
  const navFilms = navCard('film', t('title_movies'), ICONS.film());
  const navSeries = navCard('series', t('title_series'), ICONS.series());
  navLive.addEventListener('click', () => nav.go('livecategories'));
  navFilms.addEventListener('click', () => nav.go('films'));
  navSeries.addEventListener('click', () => nav.go('serieslist'));

  const addProfileBtn = el('button', { class: 'side-add', focusable: true, text: '＋  ' + t('btn_profile'), onClick: () => nav.go('profiles') });
  const favBtn = el('button', { class: 'glass-icon', focusable: true, html: ICONS.heart(), onClick: () => nav.go('favorites') });
  const setBtn = el('button', { class: 'glass-icon', focusable: true, html: ICONS.gear(), onClick: () => nav.go('settings') });
  const sidebar = el('aside', { class: 'sidebar' }, [
    el('div', { class: 'side-logo' }, [el('img', { class: 'side-logo-img', attrs: { src: 'icon.png', alt: '' } })]),
    profileName,
    premium,
    navLive, navFilms, navSeries,
    addProfileBtn,
    el('div', { class: 'side-icons' }, [favBtn, setBtn]),
  ]);

  // ---- content ----
  const banner = el('div', { class: 'banner hidden', text: t('banner_add_profile') });
  const loader = el('div', { class: 'loader' });
  const rails = el('div', { class: 'rails' });
  const conn = el('span', { class: 'conn', text: t('status_connecting') });
  const expiry = el('span', { class: 'expiry' });
  const content = el('main', { class: 'content' }, [
    banner, loader, rails,
    el('div', { class: 'bottom-bar' }, [conn, expiry]),
  ]);

  const root = el('div', { class: 'screen home-tv' }, [sidebar, content]);

  function navCard(kind: string, label: string, iconSvg: string): HTMLElement {
    return el('button', { class: `nav-card nav-${kind}`, focusable: true }, [
      el('span', { class: 'nav-ic', html: iconSvg }),
      el('span', { class: 'nav-label', text: label }),
    ]);
  }

  function onPosterSelect(i: PosterItem): void { openContent(i); }

  function appendRail(title: string, colorClass: string, items: PosterItem[]): void {
    const r = rail(title, colorClass, items, onPosterSelect);
    if (r) rails.appendChild(r);
  }

  function resolveActiveProfile(): Profile {
    let profiles = Profiles.all();
    if (profiles.length === 0) {
      const demo = Profiles.insert(DEMO);
      Settings.setSelectedProfileId(demo.id);
      Settings.setDemoMode(true);
      profiles = Profiles.all();
    }
    const hasReal = profiles.some((p) => p.username !== 'google_test');
    banner.classList.toggle('hidden', hasReal || Settings.premium());

    const savedId = Settings.selectedProfileId();
    const active = hasReal
      ? (profiles.find((p) => p.id === savedId && p.username !== 'google_test') ?? profiles.find((p) => p.username !== 'google_test')!)
      : (profiles.find((p) => p.id === savedId) ?? profiles[0]);
    Settings.setSelectedProfileId(active.id);
    return active;
  }

  async function load(): Promise<void> {
    const active = resolveActiveProfile();
    profileName.textContent = active.profileName;
    premium.style.display = Settings.premium() ? 'block' : 'none';

    // License gate (ported from MainActivity.checkLicenseAndStart): premium + demo
    // users pass; otherwise enforce the 7-day trial (fail-open via checkTrial).
    // CONFIG.freeRelease true iken kapı devre dışı: mağazadaki ücretsiz sürümde
    // paywall yok (Billing Info: Free beyanıyla tutarlı kalmak için).
    if (!CONFIG.freeRelease && !Settings.premium() && !Settings.demoMode()) {
      const trial = await checkTrial();
      if (!trial.active) { nav.replace('subscription'); return; }
      if (trial.daysLeft) {
        premium.textContent = t('msg_trial_active', trial.daysLeft);
        premium.classList.add('trial');
        premium.style.display = 'block';
      }
    }

    const client = new XtreamClient(active);

    try {
      const auth = await client.authenticate();
      if (isAuthed(auth)) {
        conn.textContent = t('status_connected');
        conn.className = 'conn ok';
        const exp = auth.user_info?.exp_date;
        expiry.textContent = exp ? fmtDate(exp) : t('status_unlimited');
      } else {
        conn.textContent = t('status_login_error');
        conn.className = 'conn err';
      }
    } catch {
      conn.textContent = t('status_server_error');
      conn.className = 'conn err';
    }

    loader.classList.add('on');
    try {
      const [movies, series] = await Promise.all([Content.movies(), Content.series()]);
      const safeMovies = movies.filter((m) => !isAdultContent(m.name));
      const safeSeries = series.filter((s) => !isAdultContent(s.name));

      const newestMovies = [...safeMovies].sort((a, b) => num(b.added) - num(a.added)).slice(0, 10);
      const newestSeries = [...safeSeries].sort((a, b) => num(b.last_modified) - num(a.last_modified)).slice(0, 8);
      const excluded = new Set<number>([...newestMovies.map((m) => m.stream_id), ...newestSeries.map((s) => s.series_id)]);

      // Personalization inputs (favorites + watch history feed the engine).
      const favs = Favorites.all();
      const favInputs = favs.map((f) => ({ streamId: f.streamId, streamType: f.streamType, name: f.name, categoryId: f.categoryId }));
      const histInputs = History.all().map((h) => ({ streamId: h.streamId, streamType: h.streamType }));
      const reco = { excludedIds: excluded, favorites: favInputs, history: histInputs };

      let recM = recommendMovies(safeMovies, { ...reco, topCategoryId: History.topCategory('vod') });
      let recS = recommendSeries(safeSeries, { ...reco, topCategoryId: History.topCategory('series') });
      if (recM.length === 0) recM = shuffle(safeMovies).slice(0, 12);
      if (recS.length === 0) recS = shuffle(safeSeries).slice(0, 12);

      const latest: PosterItem[] = [...newestMovies.map(moviePoster), ...newestSeries.map(seriesPoster)];
      const favPosters: PosterItem[] = favs.map((f) => ({ id: f.streamId, name: f.name, image: f.image, type: f.streamType === 'vod' ? 'movie' : f.streamType }));
      // Dizide poster, BÖLÜM değil ANA DİZİ id'siyle açılmalı (yoksa seriesdetail boş gelir).
      const continuePosters: PosterItem[] = History.recentUnfinished().map((h) => ({ id: h.streamType === 'series' ? (h.parentId ?? h.streamId) : h.streamId, name: h.name || '', image: h.image, type: h.streamType === 'vod' ? 'movie' : 'series', progress: h.maxDuration > 0 ? h.lastPosition / h.maxDuration : undefined }));

      rails.innerHTML = '';
      appendRail(t('my_favorites'), 'c-green', favPosters);
      appendRail(t('header_continue_watching'), 'c-blue', continuePosters);
      appendRail(t('header_recommendations_movies'), 'c-blue', recM.map(moviePoster));
      appendRail(t('header_recommendations_series'), 'c-purple', recS.map(seriesPoster));
      appendRail(t('header_latest'), 'c-pink', latest);
    } catch {
      /* rails stay empty on failure */
    } finally {
      loader.classList.remove('on');
    }
  }

  return { el: root, onMount() { void load(); } };
}

function fmtDate(ts: string): string {
  const n = parseInt(ts, 10);
  if (!n) return ts;
  try { return new Date(n * 1000).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return ts; }
}

// Netflix tarzı hızlı önizleme POPUP'ı: bir posterin üzerinde DWELL_MS bekleyince
// ekranın 3/4'ünü kaplayan, ortada 3D animasyonla beliren bir kart açılır —
// üst bölümde içerikten sessiz video önizlemesi, altta künye (konu, oyuncular,
// puan, tür…). Geri kapatır, odak geldiği postere döner; başka posterde
// beklenince yeniden açılır.
//
// TV katman notu (kritik): AVPlay videoyu grafik katmanının ARKASINDAKİ video
// düzleminde çizer; video ancak o dikdörtgendeki tüm sayfa pikselleri şeffafsa
// görünür ("hole punching"). Bu yüzden popup açıkken body.qp-open ile #root
// gizlenir, karartma TEK parça scrim yerine kartın ETRAFINI saran 4 şeritle
// yapılır ve kartın video bölgesi tamamen şeffaf bırakılır.
import { el } from './dom';
import type { PosterItem } from './components';
import { AVPlayer, type PlayOptions } from '../player/AVPlayer';
import { buildStreamUrl } from '../core/xtream';
import { getActiveProfile, getClient } from '../app/session';
import { nav } from '../app/nav';
import { setOverlayKeyHandler } from '../app/overlay';
import { KEY } from '../input/remote';
import { t } from '../i18n/strings';

const DWELL_MS = 2000;        // poster üstünde bekleme eşiği
const PREVIEW_MAX_MS = 45000; // önizleme klibi süresi (sonra posterine döner)
const POP_ANIM_MS = 520;      // 3D açılış bitmeden video başlatma (AVPlay rect sabittir)

// Kart: 1920×1080 tasarım uzayında 3/4 ekran, tam ortada.
const CARD = { x: 240, y: 135, w: 1440, h: 810 };
const VIDEO_H = 460; // kartın üst video bölümü
const VIEWPORT = { x: CARD.x, y: CARD.y, w: CARD.w, h: VIDEO_H };

interface EpisodeLite { streamId: number; name?: string; extension?: string; directUrl?: string; image?: string; }
interface PlayParams { type: 'movie' | 'series'; streamId: number; extension: string; name: string; image?: string; directUrl?: string; categoryId?: string; episodes?: EpisodeLite[]; index?: number; }

let dwellTimer = 0;
let openSeq = 0;          // bayat async yanıtları ayıklamak için jeton
let isOpen = false;
let lastCloseTs = 0;      // kapanış sonrası anında yeniden açılmayı engelle

interface Reg { item: PosterItem; onDetails: () => void; }
const REG = new WeakMap<HTMLElement, Reg>();

export function attachQuickPreview(card: HTMLElement, item: PosterItem, onOpenDetails: () => void): void {
  if (item.type === 'live') return; // canlı kanalda önizleme yok (v1)
  REG.set(card, { item, onDetails: onOpenDetails });
}

// Dwell, focus olayına değil "kumanda sustu" ilkesine bağlı: her tuşta sayaç
// sıfırlanır; odak bir posterde DWELL_MS boyunca kalırsa popup açılır.
// (Arka plandaki pencerelerde focus olayları güvenilmez; tuş olayları her yerde çalışır.)
document.addEventListener('keydown', () => {
  clearTimeout(dwellTimer);
  if (isOpen) return;
  // Router odağı bu tuşla taşıyabilir; yerleşmesini bekleyip yeni odağa bak.
  window.setTimeout(() => {
    if (isOpen || Date.now() - lastCloseTs < 600) return;
    const ae = document.activeElement as HTMLElement | null;
    const reg = ae ? REG.get(ae) : undefined;
    if (reg && document.contains(ae!)) {
      dwellTimer = window.setTimeout(() => openPreview(reg.item, ae!, reg.onDetails), DWELL_MS);
    }
  }, 0);
}, true);

function openPreview(item: PosterItem, origin: HTMLElement, onOpenDetails: () => void): void {
  if (isOpen || !document.contains(origin)) return;
  isOpen = true;
  const seq = ++openSeq;
  const openedAt = Date.now();

  // ---- DOM: 4 karartma şeridi + ortada 3D popup kart ----
  const backdrop = el('div', { class: 'qp-backdrop' });
  if (item.image) backdrop.style.backgroundImage = `url("${item.image.replace(/"/g, '%22')}")`;
  const title = el('h2', { class: 'qp-title', text: item.name });
  const chips = el('div', { class: 'qp-chips' });
  const plot = el('p', { class: 'qp-plot', text: t('qp_loading') });
  const credits = el('div', { class: 'qp-credits' });
  const playBtn = el('button', { class: 'btn primary qp-btn', focusable: true, text: t('qp_play') });
  const detailBtn = el('button', { class: 'btn qp-btn', focusable: true, text: t('qp_details') });
  const actions = el('div', { class: 'qp-actions' }, [playBtn, detailBtn, el('span', { class: 'qp-hint', text: t('qp_close_hint') })]);
  const vstat = el('div', { class: 'qp-vstat' }); // önizleme oynatılamazsa görünür ipucu
  const card = el('div', { class: 'qp-card' }, [
    el('div', { class: 'qp-video' }, [backdrop, el('div', { class: 'qp-vgrad' }), vstat]),
    el('div', { class: 'qp-info' }, [title, chips, plot, credits, actions]),
    el('div', { class: 'qp-frame' }), // neon çerçeve + parlama (içi şeffaf, tıklanmaz)
  ]);
  const root = el('div', { class: 'qp' }, [
    el('div', { class: 'qp-dim qp-dim-t' }), el('div', { class: 'qp-dim qp-dim-b' }),
    el('div', { class: 'qp-dim qp-dim-l' }), el('div', { class: 'qp-dim qp-dim-r' }),
    card,
  ]);
  document.body.appendChild(root);
  document.body.classList.add('qp-open'); // #root gizlenir → TV'de video deliği temiz kalır

  // İçerik adındaki dil/altyazı etiketlerini rozetlere çevir (katalog adlandırma
  // geleneği: "… TR-EN-FR-DE …", "… Türkçe Altyazı …").
  const langs = Array.from(new Set(item.name.toUpperCase().match(/\b(TR|EN|FR|DE|RU|AR|ES|IT|PT|NL|PL|NB)\b/g) ?? []));
  const addChip = (text: string, cls = ''): void => { chips.appendChild(el('span', { class: 'qp-chip ' + cls, text })); };

  // ---- önizleme oynatıcısı ----
  const video = document.getElementById('av-fallback') as HTMLVideoElement | null;
  if (video) video.muted = true; // tarayıcıda otomatik oynatma için; TV'de AVPlay kullanılır
  let capTimer = 0, playTimer = 0, skipped = false, playbackStarted = false;
  const preview = new AVPlayer(document.getElementById('av-player'), video, {
    onState: (s) => {
      if (seq !== openSeq) return;
      if (s === 'playing') {
        playbackStarted = true;
        vstat.textContent = '';
        backdrop.classList.add('qp-hide');
        clearTimeout(capTimer);
        capTimer = window.setTimeout(() => { preview.stop(); backdrop.classList.remove('qp-hide'); }, PREVIEW_MAX_MS);
      }
      if (s === 'ended') backdrop.classList.remove('qp-hide');
      if (s === 'error') { backdrop.classList.remove('qp-hide'); vstat.textContent = t('qp_preview_failed'); }
    },
    onTime: (cur, dur) => {
      // Jenerik/logoları atla (%5 içeriden, tek sefer) — ama yalnızca oynatma
      // FİİLEN başladıktan sonra: hazırlık aşamasındaki erken seek bazı IPTV
      // sunucularında/firmware'lerde akışı boğuyor ve klip hiç başlamıyordu.
      if (!skipped && playbackStarted && cur > 1000 && dur > 600000) { skipped = true; preview.seekTo(dur * 0.05); }
    },
  });

  // 3D açılış animasyonu bitmeden AVPlay başlamasın: video düzlemi sabit
  // dikdörtgende çizilir, animasyonla birlikte hareket edemez.
  function schedulePlay(opts: PlayOptions): void {
    const wait = Math.max(0, POP_ANIM_MS - (Date.now() - openedAt));
    clearTimeout(playTimer);
    playTimer = window.setTimeout(() => { if (seq === openSeq) preview.play(opts); }, wait);
  }

  let playParams: PlayParams | null = null;

  function close(restoreFocus: boolean): void {
    if (!isOpen) return;
    isOpen = false; openSeq++; lastCloseTs = Date.now();
    clearTimeout(capTimer); clearTimeout(dwellTimer); clearTimeout(playTimer);
    preview.stop();
    if (video) video.muted = false; // tam ekran oynatma sessiz kalmasın
    setOverlayKeyHandler(null);
    document.body.classList.remove('qp-open');
    root.remove();
    if (restoreFocus && document.contains(origin)) origin.focus();
  }

  function playNow(): void {
    if (item.type === 'series' && !playParams) { details(); return; } // bölüm bilgisi gelmediyse detaydan seçilsin
    const p = playParams ?? { type: 'movie' as const, streamId: item.id, extension: 'mp4', name: item.name, image: item.image };
    close(false);
    nav.go('player', p as unknown as Record<string, unknown>);
  }
  function details(): void { close(false); onOpenDetails(); }

  playBtn.addEventListener('click', playNow);
  detailBtn.addEventListener('click', details);

  // ---- tuş yönetimi (modal) ----
  const zone = [playBtn, detailBtn];
  let zi = 0;
  setOverlayKeyHandler((e) => {
    switch (e.keyCode) {
      case KEY.LEFT: zi = (zi + zone.length - 1) % zone.length; zone[zi].focus(); return true;
      case KEY.RIGHT: zi = (zi + 1) % zone.length; zone[zi].focus(); return true;
      case KEY.ENTER: zone[zi].click(); return true;
      case KEY.BACK: case KEY.EXIT: close(true); return true;
      default: return true; // popup açıkken diğer tuşlar alttaki ekrana inmesin
    }
  });
  requestAnimationFrame(() => playBtn.focus());

  // ---- künye + önizleme verisi ----
  void (async () => {
    const profile = getActiveProfile();
    try {
      if (item.type === 'movie') {
        const res = await getClient().getVodInfo(item.id);
        if (seq !== openSeq) return;
        const info = res.info, md = res.movie_data;
        title.textContent = info?.name || item.name;
        if (info?.movie_image) backdrop.style.backgroundImage = `url("${info.movie_image.replace(/"/g, '%22')}")`;
        if (info?.release_date) addChip(info.release_date.slice(0, 4));
        if (info?.duration) addChip(info.duration);
        if (info?.rating) addChip('★ ' + info.rating, 'qp-chip-rate');
        if (info?.genre) addChip(info.genre);
        if (langs.length) addChip('🔊 ' + langs.join(' · '));
        if (/altyaz/i.test(item.name)) addChip('💬 ' + t('track_subtitle'));
        plot.textContent = info?.plot || t('text_no_description');
        if (info?.cast) credits.appendChild(credLine(t('label_cast'), info.cast));
        if (info?.director) credits.appendChild(credLine(t('label_director'), info.director));
        playParams = { type: 'movie', streamId: item.id, extension: md?.container_extension || 'mp4', name: title.textContent || item.name, image: info?.movie_image || item.image, directUrl: md?.direct_source, categoryId: md?.category_id };
        if (profile) schedulePlay({ url: buildStreamUrl({ serverUrl: profile.serverUrl, username: profile.username, password: profile.password, streamId: item.id, type: 'movie', extension: md?.container_extension, directUrl: md?.direct_source }), viewport: VIEWPORT });
      } else {
        const res = await getClient().getSeriesInfo(item.id);
        if (seq !== openSeq) return;
        const info = res.info;
        title.textContent = info?.name || item.name;
        if (info?.cover) backdrop.style.backgroundImage = `url("${info.cover.replace(/"/g, '%22')}")`;
        if (info?.releaseDate) addChip(info.releaseDate.slice(0, 4));
        const seasonCount = res.seasons?.length ?? Object.keys(res.episodes ?? {}).length;
        if (seasonCount) addChip(seasonCount + ' ' + t('qp_seasons'));
        if (info?.rating) addChip('★ ' + info.rating, 'qp-chip-rate');
        if (info?.genre) addChip(info.genre);
        if (langs.length) addChip('🔊 ' + langs.join(' · '));
        if (/altyaz/i.test(item.name)) addChip('💬 ' + t('track_subtitle'));
        plot.textContent = info?.plot || t('text_no_description');
        if (info?.cast) credits.appendChild(credLine(t('label_cast'), info.cast));
        if (info?.director) credits.appendChild(credLine(t('label_director'), info.director));
        const firstSeason = Object.keys(res.episodes ?? {}).sort((a, b) => Number(a) - Number(b))[0];
        const seasonList = firstSeason ? (res.episodes?.[firstSeason] ?? []) : [];
        const ep = seasonList[0];
        if (ep) {
          const cover = info?.cover || item.image;
          const episodes = seasonList.map((e) => ({ streamId: parseInt(e.id, 10), name: `${title.textContent} — S${e.season ?? 1}B${e.episode_num ?? 1}`, extension: e.container_extension || 'mp4', directUrl: e.direct_source, image: cover }));
          playParams = { type: 'series', streamId: parseInt(ep.id, 10), extension: ep.container_extension || 'mp4', name: `${title.textContent} — S${ep.season ?? 1}B${ep.episode_num ?? 1}`, image: cover, directUrl: ep.direct_source, episodes, index: 0 };
          if (profile) schedulePlay({ url: buildStreamUrl({ serverUrl: profile.serverUrl, username: profile.username, password: profile.password, streamId: parseInt(ep.id, 10), type: 'series', extension: ep.container_extension, directUrl: ep.direct_source }), viewport: VIEWPORT });
        }
      }
    } catch {
      if (seq === openSeq) plot.textContent = t('error_fetch_details');
    }
  })();
}

function credLine(label: string, value: string): HTMLElement {
  return el('div', { class: 'qp-credit' }, [el('span', { class: 'qp-credit-lbl', text: label + ' ' }), document.createTextNode(value)]);
}

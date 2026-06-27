// Series detail (ported from SeriesDetailActivity): getSeriesInfo → info +
// season tabs + episode list (with watched markers) + ♥ favorite toggle.
import { el } from '../ui/dom';
import { screenHeader } from '../ui/header';
import { getClient } from '../app/session';
import { Favorites } from '../storage/favorites';
import { History } from '../storage/history';
import { ICONS } from '../ui/icons';
import { t } from '../i18n/strings';
import { nav } from '../app/nav';
import type { Episode } from '../core/models';
import type { Screen } from '../app/router';

function setBg(node: HTMLElement, url?: string): void {
  if (url) node.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
}

export function seriesDetailScreen(params: Record<string, unknown> = {}): Screen {
  const seriesId = Number(params.seriesId);
  let name = String(params.name ?? '');
  let cover: string | undefined;

  const backdrop = el('div', { class: 'detail-backdrop' });
  const poster = el('div', { class: 'detail-poster' });
  const title = el('h1', { class: 'detail-title', text: name });
  const info = el('div', { class: 'detail-meta' });
  const plot = el('p', { class: 'detail-plot' });
  const tabs = el('div', { class: 'season-tabs' });
  const epList = el('div', { class: 'episode-list' });
  const fav = el('button', { class: 'icon-action', focusable: true });

  function renderFav(): void { fav.innerHTML = ICONS.heart(Favorites.isFavorite(seriesId, 'series') ? '#FF0099' : '#90A4AE'); }
  fav.addEventListener('click', () => { Favorites.toggle({ streamId: seriesId, streamType: 'series', name, image: cover }); renderFav(); });
  renderFav();

  const root = el('div', { class: 'screen detail-screen series-detail' }, [
    backdrop,
    screenHeader(''),
    el('div', { class: 'detail-body' }, [
      poster,
      el('div', { class: 'detail-info' }, [title, info, el('div', { class: 'detail-actions' }, [fav]), plot]),
    ]),
    el('h2', { class: 'rail-title c-green episodes-head', text: t('header_episodes') }),
    tabs,
    epList,
  ]);

  const epLabel = (ep: Episode): string => `${ep.episode_num ? ep.episode_num + '. ' : ''}${ep.title || t('text_episode')}`;

  function episodeRow(ep: Episode, list: Episode[], idx: number): HTMLElement {
    const watched = History.get(parseInt(ep.id, 10), 'series')?.isFinished === true;
    const label = epLabel(ep);
    const children: Array<Node | string> = [el('span', { class: 'ep-label', text: label })];
    if (watched) children.push(el('span', { class: 'ep-watched', text: '✔' }));
    return el('button', {
      class: 'list-row ep-row' + (watched ? ' watched' : ''), focusable: true,
      attrs: { 'data-ep': ep.id },
      onClick: () => nav.go('player', {
        type: 'series', streamId: parseInt(ep.id, 10), extension: ep.container_extension || 'mp4',
        name: `${name} — ${label}`, image: cover, directUrl: ep.direct_source, seriesId,
        // Tüm sezon bölümlerini + bu bölümün sırasını geçir ki oynatıcı "sıradaki bölüm"e geçebilsin.
        episodes: list.map((e) => ({
          streamId: parseInt(e.id, 10),
          name: `${name} — ${epLabel(e)}`,
          extension: e.container_extension || 'mp4',
          directUrl: e.direct_source,
          image: cover,
        })),
        index: idx,
      }),
    }, children);
  }

  return {
    el: root,
    async onMount() {
      try {
        const res = await getClient().getSeriesInfo(seriesId);
        const i = res.info;
        const episodes = res.episodes || {};
        name = i?.name || name;
        cover = i?.cover;
        title.textContent = name;
        setBg(poster, cover);
        setBg(backdrop, cover);
        info.textContent = `${t('label_rating')} ${i?.rating || 'N/A'}  |  ${i?.genre || t('text_genre_default')}`;
        plot.textContent = i?.plot || t('text_no_description');
        renderFav();

        const seasons = Object.keys(episodes).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
        const showSeason = (sn: string): void => {
          epList.innerHTML = '';
          const list = episodes[sn] || [];
          list.forEach((ep, idx) => epList.appendChild(episodeRow(ep, list, idx)));
        };
        tabs.innerHTML = '';
        const tabBySeason: Record<string, HTMLElement> = {};
        const activateSeason = (sn: string): void => {
          Array.from(tabs.children).forEach((c) => c.classList.remove('active'));
          tabBySeason[sn]?.classList.add('active');
          showSeason(sn);
        };
        seasons.forEach((sn) => {
          const tab = el('button', { class: 'season-tab', focusable: true, text: `${t('text_season')} ${sn}`, onClick: () => activateSeason(sn) });
          tabBySeason[sn] = tab;
          tabs.appendChild(tab);
        });

        // Geri dönüldüğünde en son izlenen bölümü hatırla: o sezonu aç + satırı odakla.
        let lastSeason = seasons[0]; let lastEpId: string | null = null; let lastTs = -1;
        for (const sn of seasons) {
          for (const ep of episodes[sn] || []) {
            const h = History.get(parseInt(ep.id, 10), 'series');
            if (h && h.timestamp > lastTs) { lastTs = h.timestamp; lastSeason = sn; lastEpId = ep.id; }
          }
        }
        if (seasons.length) {
          activateSeason(lastSeason);
          if (lastEpId != null) {
            requestAnimationFrame(() => {
              const row = epList.querySelector<HTMLElement>(`[data-ep="${lastEpId}"]`);
              if (row) { row.scrollIntoView({ block: 'center' }); row.focus(); }
            });
          }
        }
      } catch {
        plot.textContent = t('error_fetch_details');
      }
    },
  };
}

// Movie detail (ported from FilmDetailActivity): getVodInfo → poster/plot/meta,
// "Hemen İzle" (plays with the real container extension) + ♥ favorite toggle.
import { el } from '../ui/dom';
import { screenHeader } from '../ui/header';
import { getClient } from '../app/session';
import { Favorites } from '../storage/favorites';
import { ICONS } from '../ui/icons';
import { t } from '../i18n/strings';
import { nav } from '../app/nav';
import type { Screen } from '../app/router';

function setBg(node: HTMLElement, url?: string): void {
  if (url) node.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
}

export function filmDetailScreen(params: Record<string, unknown> = {}): Screen {
  const streamId = Number(params.streamId);
  let name = String(params.name ?? '');
  let ext = 'mp4';
  let directUrl: string | undefined;
  let image: string | undefined;
  let categoryId: string | undefined;

  const backdrop = el('div', { class: 'detail-backdrop' });
  const poster = el('div', { class: 'detail-poster' });
  const title = el('h1', { class: 'detail-title', text: name });
  const meta = el('div', { class: 'detail-meta' });
  const rating = el('div', { class: 'detail-rating' });
  const plot = el('p', { class: 'detail-plot' });
  const credits = el('div', { class: 'detail-credits' });
  const watch = el('button', {
    class: 'btn primary big', focusable: true, text: t('watch_now'),
    attrs: { 'data-initial-focus': '' },
    onClick: () => nav.go('player', { type: 'movie', streamId, extension: ext, name, directUrl, image, categoryId }),
  });
  const fav = el('button', { class: 'icon-action', focusable: true });

  function renderFav(): void { fav.innerHTML = ICONS.heart(Favorites.isFavorite(streamId, 'vod') ? '#FF0099' : '#90A4AE'); }
  fav.addEventListener('click', () => { Favorites.toggle({ streamId, streamType: 'vod', name, image, categoryId }); renderFav(); });
  renderFav();

  function credit(label: string, value?: string): HTMLElement {
    return el('div', { class: 'credit' }, [el('span', { class: 'lbl', text: label + ' ' }), document.createTextNode(value || '-')]);
  }

  const root = el('div', { class: 'screen detail-screen' }, [
    backdrop,
    screenHeader(''),
    el('div', { class: 'detail-body' }, [
      poster,
      el('div', { class: 'detail-info' }, [
        title, meta, rating,
        el('div', { class: 'detail-actions' }, [watch, fav]),
        plot, credits,
      ]),
    ]),
  ]);

  return {
    el: root,
    async onMount() {
      try {
        const res = await getClient().getVodInfo(streamId);
        const info = res.info;
        const md = res.movie_data;
        name = info?.name || name;
        ext = md?.container_extension || 'mp4';
        directUrl = md?.direct_source;
        image = info?.movie_image;
        categoryId = md?.category_id;

        title.textContent = name;
        setBg(poster, image);
        setBg(backdrop, image);
        meta.textContent = [info?.release_date, info?.duration, info?.genre || t('text_genre_default')].filter(Boolean).join('  |  ');
        rating.textContent = `${t('label_rating')} ${info?.rating || 'N/A'}`;
        plot.textContent = info?.plot || t('text_no_description');
        credits.appendChild(credit(t('label_cast'), info?.cast));
        credits.appendChild(credit(t('label_director'), info?.director));
        renderFav();
      } catch {
        plot.textContent = t('error_fetch_details');
      }
      watch.focus();
    },
  };
}

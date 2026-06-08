// Favorites grid (ported from FavoritesActivity). Reachable from the sidebar ♥.
import { el } from '../ui/dom';
import { screenHeader } from '../ui/header';
import { posterGrid } from '../ui/lists';
import { Favorites } from '../storage/favorites';
import { openContent } from '../app/open-content';
import { t } from '../i18n/strings';
import type { PosterItem } from '../ui/components';
import type { Screen } from '../app/router';

export function favoritesScreen(): Screen {
  const body = el('div', { class: 'grid-wrap' });
  const root = el('div', { class: 'screen grid-screen' }, [screenHeader(t('my_favorites')), body]);

  return {
    el: root,
    onMount() {
      const items: PosterItem[] = Favorites.all().map((f) => ({
        id: f.streamId,
        name: f.name,
        image: f.image,
        type: f.streamType === 'vod' ? 'movie' : f.streamType,
      }));
      body.innerHTML = '';
      if (items.length === 0) { body.appendChild(el('p', { class: 'empty', text: t('msg_content_not_found') })); return; }
      body.appendChild(posterGrid(items, openContent));
    },
  };
}

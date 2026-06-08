// Movies: category chips + poster grid + search (ported from FilmsActivity).
import { el } from '../ui/dom';
import { screenHeader } from '../ui/header';
import { posterGrid } from '../ui/lists';
import { Content } from '../app/session';
import { t } from '../i18n/strings';
import { nav } from '../app/nav';
import { isAdultContent } from '../core/recommendation';
import type { VodStream, VodCategory } from '../core/models';
import type { PosterItem } from '../ui/components';
import type { Screen } from '../app/router';

const poster = (m: VodStream): PosterItem => ({ id: m.stream_id, name: m.name || '', image: m.stream_icon, type: 'movie' });

export function filmsScreen(): Screen {
  let movies: VodStream[] = [];
  let cats: VodCategory[] = [];
  let activeCat = 'all';
  let query = '';

  const chips = el('div', { class: 'chips' });
  const gridBox = el('div', { class: 'grid-wrap' });
  const root = el('div', { class: 'screen grid-screen' }, [
    screenHeader(t('title_movies'), { searchHint: t('hint_search_movie'), onSearch: (q) => { query = q; renderGrid(); } }),
    chips, gridBox,
  ]);

  function chip(label: string, id: string): HTMLElement {
    return el('button', {
      class: 'chip-btn' + (id === activeCat ? ' active' : ''), focusable: true, text: label,
      onClick: () => { activeCat = id; renderChips(); renderGrid(); },
    });
  }
  function renderChips(): void {
    chips.innerHTML = '';
    chips.appendChild(chip(t('category_all_movies'), 'all'));
    for (const c of cats) chips.appendChild(chip(c.category_name, c.category_id));
  }
  function renderGrid(): void {
    const items = movies
      .filter((m) => (activeCat === 'all' || String(m.category_id) === activeCat) && (!query || (m.name || '').toLowerCase().includes(query)))
      .slice(0, 200)
      .map(poster);
    gridBox.innerHTML = '';
    if (items.length === 0) { gridBox.appendChild(el('p', { class: 'empty', text: t('msg_content_not_found') })); return; }
    gridBox.appendChild(posterGrid(items, (i) => nav.go('filmdetail', { streamId: i.id, name: i.name })));
  }

  return {
    el: root,
    async onMount() {
      const [m, c] = await Promise.all([Content.movies(), Content.vodCategories()]);
      movies = m.filter((x) => !isAdultContent(x.name));
      cats = c;
      renderChips();
      renderGrid();
    },
  };
}

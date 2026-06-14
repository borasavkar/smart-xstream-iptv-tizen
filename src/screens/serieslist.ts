// Series: category chips + poster grid + search (ported from SeriesListActivity).
import { el } from '../ui/dom';
import { screenHeader } from '../ui/header';
import { posterGrid } from '../ui/lists';
import { Content } from '../app/session';
import { t } from '../i18n/strings';
import { nav } from '../app/nav';
import { isAdultContent } from '../core/recommendation';
import type { SeriesStream, LiveCategory } from '../core/models';
import type { PosterItem } from '../ui/components';
import type { Screen } from '../app/router';

const poster = (s: SeriesStream): PosterItem => ({ id: s.series_id, name: s.name || '', image: s.cover || s.stream_icon, type: 'series' });

export function seriesListScreen(): Screen {
  let series: SeriesStream[] = [];
  let cats: LiveCategory[] = [];
  let activeCat = 'all';
  let query = '';

  const chips = el('div', { class: 'chips' });
  const gridBox = el('div', { class: 'grid-wrap' });
  const root = el('div', { class: 'screen grid-screen' }, [
    screenHeader(t('title_series'), { searchHint: t('hint_search_series'), onSearch: (q) => { query = q; renderGrid(); } }),
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
    chips.appendChild(chip(t('category_all_series'), 'all'));
    for (const c of cats) chips.appendChild(chip(c.category_name, c.category_id));
  }
  function renderGrid(): void {
    const items = series
      .filter((s) => (activeCat === 'all' || String(s.category_id) === activeCat) && (!query || (s.name || '').toLowerCase().includes(query)))
      .slice(0, 200)
      .map(poster);
    gridBox.innerHTML = '';
    if (items.length === 0) { gridBox.appendChild(el('p', { class: 'empty', text: t('msg_content_not_found') })); return; }
    gridBox.appendChild(posterGrid(items, (i) => nav.go('seriesdetail', { seriesId: i.id, name: i.name })));
  }

  return {
    el: root,
    async onMount() {
      const [s, c] = await Promise.all([Content.series(), Content.seriesCategories()]);
      series = s.filter((x) => !isAdultContent(x.name));
      cats = c;
      renderChips();
      renderGrid();
      // Ekran üst menüde (kategori çubuğu) açılsın — odak ‹ geri butonu yerine
      // aktif/ilk kategori çipinde başlasın.
      requestAnimationFrame(() => (chips.querySelector('.chip-btn.active') as HTMLElement | null ?? chips.querySelector('.chip-btn') as HTMLElement | null)?.focus());
    },
  };
}

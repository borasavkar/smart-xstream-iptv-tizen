// Live TV: category chips + channel poster grid + search — Filmler/Diziler ile
// aynı düzen. Bir kanala tıklayınca doğrudan oynatır (canlıda detay yok);
// filtrelenmiş liste oynatıcıya geçer ki Yukarı/Aşağı kanal değiştirsin.
import { el } from '../ui/dom';
import { screenHeader } from '../ui/header';
import { posterGrid } from '../ui/lists';
import { Content } from '../app/session';
import { t } from '../i18n/strings';
import { nav } from '../app/nav';
import type { LiveStream, LiveCategory } from '../core/models';
import type { PosterItem } from '../ui/components';
import type { Screen } from '../app/router';

const poster = (c: LiveStream): PosterItem => ({ id: c.stream_id, name: c.name || '', image: c.stream_icon, type: 'live' });

export function liveCategoriesScreen(): Screen {
  let channels: LiveStream[] = [];
  let cats: LiveCategory[] = [];
  let activeCat = 'all';
  let query = '';

  const chips = el('div', { class: 'chips' });
  const gridBox = el('div', { class: 'grid-wrap' });
  const root = el('div', { class: 'screen grid-screen' }, [
    screenHeader(t('title_live'), { searchHint: t('hint_search_channel'), onSearch: (q) => { query = q; renderGrid(); } }),
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
    chips.appendChild(chip(t('category_all_live'), 'all'));
    for (const c of cats) chips.appendChild(chip(c.category_name, c.category_id));
  }
  function renderGrid(): void {
    const items = channels
      .filter((c) => (activeCat === 'all' || String(c.category_id) === activeCat) && (!query || (c.name || '').toLowerCase().includes(query)))
      .slice(0, 200);
    gridBox.innerHTML = '';
    if (items.length === 0) { gridBox.appendChild(el('p', { class: 'empty', text: t('msg_no_channels_in_category') })); return; }
    // Tüm filtrelenmiş liste oynatıcıya gider → Yukarı/Aşağı ile kanal zaplama.
    const playlist = items.map((c) => ({ streamId: c.stream_id, name: c.name, image: c.stream_icon, directUrl: c.direct_source || c.directSource }));
    gridBox.appendChild(posterGrid(items.map(poster), (i) => {
      const idx = items.findIndex((c) => c.stream_id === i.id);
      nav.go('player', {
        type: 'live', streamId: i.id, name: i.name, extension: 'ts',
        directUrl: playlist[idx]?.directUrl, channels: playlist, index: idx < 0 ? 0 : idx,
      });
    }));
  }

  return {
    el: root,
    async onMount() {
      const [live, c] = await Promise.all([Content.liveStreams(), Content.liveCategories()]);
      channels = live;
      cats = c;
      renderChips();
      renderGrid();
      // Ekran üst menüde (kategori çubuğu) açılsın — Filmler/Diziler ile aynı.
      requestAnimationFrame(() => (chips.querySelector('.chip-btn.active') as HTMLElement | null ?? chips.querySelector('.chip-btn') as HTMLElement | null)?.focus());
    },
  };
}

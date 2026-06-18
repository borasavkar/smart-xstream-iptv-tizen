// Reusable content components: poster card + horizontal rail.
// Ported from item_movie_card.xml (image + bottom title overlay) and the
// home RecyclerViews. Reused by Phase 2 list/detail screens too.
import { el } from './dom';
import { attachQuickPreview } from './quickpreview';
import { History } from '../storage/history';

export interface PosterItem {
  id: number;
  name: string;
  image?: string;
  type: 'live' | 'movie' | 'series';
  progress?: number; // 0..1 — izlenme oranı (sağlanmazsa filmde geçmişten okunur)
}

// Posterin izlenme oranı: önce verilen değer, yoksa filmde geçmişten (dizi geçmişi
// bölüm bazlı olduğundan dizi posteri için poster id ile eşleşmez).
function watchedFraction(item: PosterItem): number | undefined {
  if (typeof item.progress === 'number') return item.progress;
  if (item.type === 'movie') {
    const h = History.get(item.id, 'vod');
    if (h && !h.isFinished && h.maxDuration > 0 && h.lastPosition > 0) return h.lastPosition / h.maxDuration;
  }
  return undefined;
}

export function posterCard(item: PosterItem, onSelect: (i: PosterItem) => void): HTMLElement {
  const img = el('div', { class: 'poster-img' });
  if (item.image) img.style.backgroundImage = `url("${item.image.replace(/"/g, '%22')}")`;
  else img.classList.add('poster-img--empty');

  // İzleme göstergesi: yarım bırakılan medyada alt kenarda ince ilerleme çubuğu.
  const frac = watchedFraction(item);
  if (frac != null && frac > 0.02 && frac < 0.98) {
    const fill = el('div', { class: 'poster-prog-fill' });
    fill.style.width = Math.round(frac * 100) + '%';
    img.appendChild(el('div', { class: 'poster-prog' }, [fill]));
  }

  const card = el('button', { class: 'poster', focusable: true, onClick: () => onSelect(item) }, [
    img,
    el('div', { class: 'poster-title', text: item.name || '—' }),
  ]);
  // Üzerinde bekleyince hızlı önizleme katmanı; "Detaylar" düğmesi kartın
  // normal tıklama davranışını (ekranın verdiği onSelect) kullanır.
  attachQuickPreview(card, item, () => onSelect(item));
  return card;
}

/** Returns a rail section, or null when there is nothing to show (hides empty rails, like the app). */
export function rail(
  title: string,
  colorClass: string,
  items: PosterItem[],
  onSelect: (i: PosterItem) => void,
): HTMLElement | null {
  if (!items.length) return null;
  return el('section', { class: 'rail' }, [
    el('h2', { class: 'rail-title ' + colorClass, text: title }),
    el('div', { class: 'rail-row' }, items.map((i) => posterCard(i, onSelect))),
  ]);
}

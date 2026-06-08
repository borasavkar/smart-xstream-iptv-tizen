// List/grid building blocks for category, channel and poster-grid screens.
import { el } from './dom';
import { posterCard, type PosterItem } from './components';

export function categoryRow(label: string, onClick: () => void): HTMLElement {
  return el('button', { class: 'list-row', focusable: true, text: label, onClick });
}

export function channelRow(name: string, icon: string | undefined, onClick: () => void): HTMLElement {
  const thumb = el('div', { class: 'ch-thumb' });
  if (icon) thumb.style.backgroundImage = `url("${icon.replace(/"/g, '%22')}")`;
  return el('button', { class: 'list-row ch-row', focusable: true, onClick }, [
    thumb,
    el('span', { class: 'ch-name', text: name }),
  ]);
}

export function posterGrid(items: PosterItem[], onSelect: (i: PosterItem) => void): HTMLElement {
  return el('div', { class: 'poster-grid' }, items.map((i) => posterCard(i, onSelect)));
}

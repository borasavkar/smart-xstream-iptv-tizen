// Screen header: back affordance + title + optional search box.
import { el } from './dom';
import { nav } from '../app/nav';

export interface HeaderOpts {
  onSearch?: (query: string) => void;
  searchHint?: string;
}

export function screenHeader(title: string, opts: HeaderOpts = {}): HTMLElement {
  const children: Array<Node | string> = [
    el('button', { class: 'back-btn', focusable: true, text: '‹', onClick: () => nav.back() }),
    el('h1', { class: 'screen-title', text: title }),
  ];
  if (opts.onSearch) {
    const search = el('input', { class: 'search', focusable: true, placeholder: opts.searchHint || 'Ara…' });
    search.addEventListener('input', () => opts.onSearch!(search.value.trim().toLowerCase()));
    children.push(search);
  }
  return el('header', { class: 'screen-header' }, children);
}

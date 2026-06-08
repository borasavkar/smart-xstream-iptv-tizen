// Tiny DOM helpers (hyperscript-style) used across screens.

interface ElOpts {
  class?: string;
  id?: string;
  text?: string;
  html?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  focusable?: boolean;
  onClick?: () => void;
  attrs?: Record<string, string>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: ElOpts = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.id) node.id = opts.id;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.html != null) node.innerHTML = opts.html;
  if (opts.type) (node as unknown as { type: string }).type = opts.type;
  if (opts.placeholder != null) (node as unknown as { placeholder: string }).placeholder = opts.placeholder;
  if (opts.value != null) (node as unknown as { value: string }).value = opts.value;
  if (opts.focusable) { node.tabIndex = 0; node.setAttribute('data-focusable', ''); }
  if (opts.onClick) node.addEventListener('click', opts.onClick);
  if (opts.attrs) for (const k of Object.keys(opts.attrs)) node.setAttribute(k, opts.attrs[k]);
  for (const c of children) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function clear(node: HTMLElement): void { node.innerHTML = ''; }

let toastTimer = 0;
export function toast(message: string): void {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = message;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 2600);
}

// Minimal screen router: a navigation stack that mounts one Screen at a time
// into a root element, plus global remote-key handling (arrows → spatial focus,
// Enter → activate, Back → pop/exit). Screens can intercept keys via onKey.
import { KEY, moveFocus, focusFirst } from '../input/remote';
import { overlayKey } from './overlay';
import { showExitConfirm } from './exit-confirm';

export interface Screen {
  el: HTMLElement;
  onMount?(): void;
  /** Return true if the key was handled (stops the router's default handling). */
  onKey?(e: KeyboardEvent): boolean;
  onDestroy?(): void;
}

export type ScreenFactory = (params?: Record<string, unknown>) => Screen;

interface Entry { name: string; params?: Record<string, unknown>; }

export class Router {
  private readonly root: HTMLElement;
  private readonly factories = new Map<string, ScreenFactory>();
  private readonly stack: Entry[] = [];
  private current: Screen | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    // Capture phase so we handle remote keys before the platform's own focus
    // navigation (which otherwise fights our JS focus management on the TV).
    document.addEventListener('keydown', (e) => this.handleKey(e), true);
  }

  register(name: string, factory: ScreenFactory): void {
    this.factories.set(name, factory);
  }

  navigate(name: string, params?: Record<string, unknown>): void {
    this.stack.push({ name, params });
    this.mount(name, params);
  }

  replace(name: string, params?: Record<string, unknown>): void {
    if (this.stack.length) this.stack[this.stack.length - 1] = { name, params };
    else this.stack.push({ name, params });
    this.mount(name, params);
  }

  back(): void {
    // Ana ekranda (geri gidilecek yer yok) çıkış onayı göster (Samsung Return-key politikası).
    if (this.stack.length <= 1) { showExitConfirm(); return; }
    this.stack.pop();
    const top = this.stack[this.stack.length - 1];
    this.mount(top.name, top.params);
  }

  private mount(name: string, params?: Record<string, unknown>): void {
    this.current?.onDestroy?.();
    this.root.innerHTML = '';
    const factory = this.factories.get(name);
    if (!factory) { console.error('Router: unknown screen', name); return; }
    const screen = factory(params);
    this.current = screen;
    this.root.appendChild(screen.el);
    screen.onMount?.();
    // Let a screen pick its initial focus via [data-initial-focus]; else first focusable.
    requestAnimationFrame(() => {
      const preferred = this.root.querySelector<HTMLElement>('[data-initial-focus]');
      if (preferred && preferred.offsetParent !== null) preferred.focus();
      else focusFirst();
    });
  }

  private handleKey(e: KeyboardEvent): void {
    // Açık bir üst katman (hızlı önizleme vb.) tuşu yutarsa ekrana hiç sorma.
    if (overlayKey(e)) { e.preventDefault(); e.stopPropagation(); return; }
    // When a screen handles the key, stop the platform default (focus move / scroll).
    if (this.current?.onKey?.(e)) { e.preventDefault(); e.stopPropagation(); return; }

    const ae = document.activeElement as HTMLElement | null;
    const isInput = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');

    switch (e.keyCode) {
      case KEY.LEFT:
        if (isInput) return; // Metin kutusundayken harfler arası gezinebilmek için native akışa bırak
        moveFocus('left'); e.preventDefault(); break;
      case KEY.RIGHT:
        if (isInput) return; // Metin kutusundayken harfler arası gezinebilmek için native akışa bırak
        moveFocus('right'); e.preventDefault(); break;
      case KEY.UP: moveFocus('up'); e.preventDefault(); break;
      case KEY.DOWN: moveFocus('down'); e.preventDefault(); break;
      case KEY.ENTER: {
        const tag = ae?.tagName.toLowerCase();
        if (ae?.hasAttribute('data-focusable') && tag !== 'input' && tag !== 'select' && tag !== 'textarea') {
          ae.click();
          e.preventDefault();
        }
        break;
      }
      case KEY.BACK:
      case KEY.EXIT:
        // Yazarken Return ekrandan atmasın: sadece alandan çıkılır, form verisi korunur.
        if (e.keyCode === KEY.BACK && isInput && ae) { ae.blur(); e.preventDefault(); break; }
        this.back();
        e.preventDefault();
        break;
    }
  }
}

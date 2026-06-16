// Çıkış onayı diyalogu — Samsung "Return Key Policy" gereği: ana ekranda
// Return/Exit'e basılınca GÖRÜNÜR bir çıkış onayı çıkar, "Çıkış" ile uygulama
// tizen.application...exit() ile sonlandırılır. Overlay tuş kaydını kullanır,
// böylece açıkken tüm kumanda tuşlarını yakalar.
import { el } from '../ui/dom';
import { t } from '../i18n/strings';
import { KEY, exitApp } from '../input/remote';
import { setOverlayKeyHandler } from './overlay';

let open = false;
export function isExitConfirmOpen(): boolean { return open; }

export function showExitConfirm(): void {
  if (open) return;
  open = true;

  const yes = el('button', { class: 'btn primary exit-btn', focusable: true, text: t('exit_yes'), onClick: () => exitApp() });
  const no = el('button', { class: 'btn exit-btn', focusable: true, text: t('exit_no'), onClick: () => close() });
  const root = el('div', { class: 'exit-overlay' }, [
    el('div', { class: 'exit-card' }, [
      el('div', { class: 'exit-title', text: t('exit_title') }),
      el('div', { class: 'exit-actions' }, [yes, no]),
    ]),
  ]);
  document.body.appendChild(root);

  const zone = [yes, no];
  let zi = 0;
  requestAnimationFrame(() => yes.focus());

  function close(): void {
    if (!open) return;
    open = false;
    setOverlayKeyHandler(null);
    root.remove();
  }

  setOverlayKeyHandler((e) => {
    switch (e.keyCode) {
      case KEY.LEFT: case KEY.RIGHT: zi = zi === 0 ? 1 : 0; zone[zi].focus(); return true;
      case KEY.UP: case KEY.DOWN: return true;
      case KEY.ENTER: zone[zi].click(); return true;
      case KEY.BACK: case KEY.EXIT: close(); return true; // Geri = iptal (çıkma)
      default: return true; // diyalog açıkken hiçbir tuş alttaki ekrana inmesin
    }
  });
}

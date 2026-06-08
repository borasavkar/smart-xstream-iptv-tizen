// Samsung TV remote: key codes, key registration, app exit, and a small
// geometry-based spatial-navigation focus manager. All reused by the full app.

export const KEY = {
  LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
  ENTER: 13,
  BACK: 10009,   // "Return" key on Samsung remotes
  EXIT: 10182,
  PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, STOP: 413,
  REWIND: 412, FASTFORWARD: 417,
} as const;

/** Register media keys so the platform routes them to our keydown handler. */
export function registerRemoteKeys(): void {
  if (typeof tizen === 'undefined' || !tizen.tvinputdevice) return;
  for (const k of ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaRewind', 'MediaFastForward']) {
    try { tizen.tvinputdevice.registerKey(k); } catch { /* key not supported on this model */ }
  }
}

export function exitApp(): void {
  try {
    if (typeof tizen !== 'undefined') { tizen.application.getCurrentApplication().exit(); return; }
  } catch { /* fall through */ }
  try { window.close(); } catch { /* */ }
}

// ---------------- spatial navigation ----------------

type Dir = 'up' | 'down' | 'left' | 'right';

/** Visible, enabled elements marked with [data-focusable]. */
export function focusables(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-focusable]'))
    .filter((el) => el.offsetParent !== null && !el.hasAttribute('disabled'));
}

export function focusFirst(): void {
  const f = focusables();
  if (f.length) f[0].focus();
}

/** Move DOM focus to the nearest focusable in the given direction. */
export function moveFocus(dir: Dir): void {
  const items = focusables();
  if (!items.length) return;

  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !items.includes(cur)) { items[0].focus(); return; }

  const c = cur.getBoundingClientRect();
  const ccx = c.left + c.width / 2;
  const ccy = c.top + c.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of items) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - ccx;
    const dy = r.top + r.height / 2 - ccy;

    const inDir =
      dir === 'left' ? dx < -4 :
      dir === 'right' ? dx > 4 :
      dir === 'up' ? dy < -4 : dy > 4;
    if (!inDir) continue;

    const horizontal = dir === 'left' || dir === 'right';
    const primary = horizontal ? Math.abs(dx) : Math.abs(dy);
    const cross = horizontal ? Math.abs(dy) : Math.abs(dx);
    const score = primary + cross * 2; // prefer aligned, then close
    if (score < bestScore) { bestScore = score; best = el; }
  }

  best?.focus();
}

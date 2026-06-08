// Stable per-device identifier. On a real Tizen TV this is the hardware DUID
// (via the Product API); in a browser it falls back to a generated id.
export function getDeviceId(): string {
  try {
    if (typeof webapis !== 'undefined' && webapis.productinfo && typeof webapis.productinfo.getDuid === 'function') {
      const duid = webapis.productinfo.getDuid();
      if (duid) return String(duid);
    }
  } catch { /* fall through */ }

  let id = localStorage.getItem('sx_device_id');
  if (!id) {
    id = 'web-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem('sx_device_id', id);
  }
  return id;
}

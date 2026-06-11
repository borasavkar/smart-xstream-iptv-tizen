// Ekran-üstü katmanlar (ör. hızlı önizleme) için tuş yakalama kaydı.
// Router, ekrana sormadan ÖNCE buraya sorar; kayıtlı katman true dönerse
// olay tüketilmiş sayılır. Ayrı modül: router ↔ katman döngüsel import olmasın.

export type OverlayKeyHandler = (e: KeyboardEvent) => boolean;

let handler: OverlayKeyHandler | null = null;

export function setOverlayKeyHandler(h: OverlayKeyHandler | null): void { handler = h; }

export function overlayKey(e: KeyboardEvent): boolean { return handler ? handler(e) : false; }

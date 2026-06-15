// SRT / WebVTT altyazı ayrıştırıcı. İndirilen dış altyazılar (OpenSubtitles)
// kendi altyazı katmanımızda, oynatma zamanına göre senkron gösterilir.

export interface Cue { start: number; end: number; text: string; } // ms

// "00:01:02,500" veya "00:01:02.500" → ms
function tc(t: string): number {
  const m = t.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!m) return -1;
  return ((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])) * 1000 + Number(m[4].padEnd(3, '0'));
}

// Basit HTML/etiket temizliği (SRT bazen <i>, {\an8}, font etiketleri taşır).
function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\r/g, '')
    .trim();
}

/** SRT veya VTT metnini sıralı cue dizisine çevir. */
export function parseSubtitles(raw: string): Cue[] {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const cues: Cue[] = [];
  // Zaman satırını yakala: "hh:mm:ss,ms --> hh:mm:ss,ms" (araya stil gelebilir)
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    let i = 0;
    // İlk satır numara olabilir (SRT) — atla.
    if (i < lines.length && /^\d+$/.test(lines[i].trim())) i++;
    const timeLine = lines[i] || '';
    const tm = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/);
    if (!tm) continue;
    const start = tc(tm[1]); const end = tc(tm[2]);
    if (start < 0 || end < 0) continue;
    const body = clean(lines.slice(i + 1).join('\n'));
    if (body) cues.push({ start, end, text: body });
  }
  cues.sort((a, b) => a.start - b.start);
  return cues;
}

/** Verilen ms konumundaki aktif cue metni (yoksa boş). */
export function cueAt(cues: Cue[], ms: number): string {
  // Küçük diziler için doğrusal arama yeterli; binlerce cue için ikili arama.
  let lo = 0, hi = cues.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= ms) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (ans >= 0 && ms <= cues[ans].end) return cues[ans].text;
  return '';
}

// İndirilen baytları metne çevir: UTF-8 dene; bozuksa (Türkçe için) Windows-1254'e düş.
export function decodeSubtitle(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const utf8 = tryDecode(bytes, 'utf-8');
  // U+FFFD (replacement) yoğunsa kodlama yanlıştır → 1254 dene.
  if (utf8 && replacementRatio(utf8) < 0.002) return utf8;
  const win = tryDecode(bytes, 'windows-1254') || tryDecode(bytes, 'iso-8859-9');
  return win || utf8 || '';
}

function tryDecode(bytes: Uint8Array, enc: string): string {
  try { return new TextDecoder(enc as 'utf-8', { fatal: false }).decode(bytes); }
  catch { return ''; }
}
function replacementRatio(s: string): number {
  let n = 0; for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xFFFD) n++;
  return s.length ? n / s.length : 0;
}

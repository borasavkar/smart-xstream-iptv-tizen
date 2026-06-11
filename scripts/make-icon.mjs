// Generates a 512x512 placeholder app icon (icon.png) with zero dependencies.
// Dark gradient background + neon-green disc + dark play triangle.
// icon.png now ships the real Play Store artwork (ic_launcher-playstore.png),
// so this script refuses to overwrite an existing icon.
import { writeFileSync, existsSync } from 'fs';
import { deflateSync } from 'zlib';

const outPath = fileURLToPathSafe(new URL('../icon.png', import.meta.url));
if (existsSync(outPath)) {
  console.log('icon.png exists (real brand artwork) — not overwriting. Delete it first to regenerate the placeholder.');
  process.exit(0);
}

const W = 512, H = 512;
const px = Buffer.alloc(W * H * 4);
const set = (x, y, r, g, b, a = 255) => { const i = (y * W + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };

// Background vertical gradient (#0B0F14 -> #11202E)
for (let y = 0; y < H; y++) {
  const t = y / H;
  const r = Math.round(11 + 6 * t), g = Math.round(15 + 17 * t), b = Math.round(20 + 26 * t);
  for (let x = 0; x < W; x++) set(x, y, r, g, b);
}
// Neon green disc (#00E676)
const cx = 256, cy = 256, rad = 178;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const dx = x - cx, dy = y - cy;
  if (dx * dx + dy * dy <= rad * rad) set(x, y, 0, 230, 118);
}
// Dark play triangle inside disc
const ax = 212, ay = 168, bx = 212, by = 344, tx = 366, ty = 256;
const sign = (x, y, x1, y1, x2, y2) => (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const d1 = sign(x, y, ax, ay, bx, by), d2 = sign(x, y, bx, by, tx, ty), d3 = sign(x, y, tx, ty, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0, hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  if (!(hasNeg && hasPos)) set(x, y, 11, 15, 20);
}

// --- minimal PNG encoder ---
const crc32 = (buf) => { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, y * W * 4 + W * 4); }
const idat = deflateSync(raw, { level: 9 });
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);

const out = fileURLToPathSafe(new URL('../icon.png', import.meta.url));
writeFileSync(out, png);
console.log('icon.png written:', out, `(${png.length} bytes)`);

function fileURLToPathSafe(u) { return decodeURIComponent(u.pathname.replace(/^\/([A-Za-z]:)/, '$1')); }

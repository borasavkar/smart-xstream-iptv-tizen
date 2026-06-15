// OpenSubtitles (opensubtitles.com) REST API istemcisi.
// İki kimlik: (1) Api-Key = uygulamanın consumer kimliği (config'te, gömülü),
// (2) kullanıcının kendi hesabı (login → token; indirme onların kotasından).
// NOT: Tüm istekler için Api-Key zorunlu. CORS gerçek TV'de doğrulanmalı.
import { CONFIG } from '../config/app-config';
import { Settings } from '../storage/settings';
import { decodeSubtitle, parseSubtitles, type Cue } from './srt';

const DEFAULT_BASE = 'https://api.opensubtitles.com';
const baseUrl = (): string => Settings.osBaseUrl() || DEFAULT_BASE;

function headers(auth: boolean): Record<string, string> {
  const h: Record<string, string> = {
    'Api-Key': CONFIG.openSubtitles.apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // User-Agent tarayıcıda yok sayılır; TV'de geçerli olabilir, zararsız.
    'User-Agent': CONFIG.openSubtitles.userAgent,
  };
  const tok = Settings.osToken();
  if (auth && tok) h['Authorization'] = 'Bearer ' + tok;
  return h;
}

// OpenSubtitles dil kodları çoğunlukla ISO 639-1 (2 harf); birkaçı özel.
function osLang(code: string): string {
  const c = (code || '').toLowerCase();
  const map: Record<string, string> = { pt: 'pt-pt', zh: 'zh-cn' };
  return map[c] || c;
}

export interface OsSubtitle { fileId: number; language: string; release: string; downloads: number; }
export interface LoginResult { ok: boolean; message?: string; }
export interface DownloadInfo { remaining: number; }

export function isLoggedIn(): boolean { return !!Settings.osToken(); }
export function logout(): void { Settings.clearOsSession(); }

export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch(DEFAULT_BASE + '/api/v1/login', {
      method: 'POST', headers: headers(false), body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 400) return { ok: false, message: 'Kullanıcı adı veya şifre hatalı' };
      return { ok: false, message: 'Sunucu hatası (' + res.status + ')' };
    }
    const data = await res.json() as { token?: string; base_url?: string };
    if (!data.token) return { ok: false, message: 'Giriş başarısız' };
    const base = data.base_url ? 'https://' + data.base_url.replace(/^https?:\/\//, '') : DEFAULT_BASE;
    Settings.setOsSession(username, data.token, base);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Bağlanılamadı (ağ/CORS)' };
  }
}

// "Film Adı - TR-EN - 1080p (2026)" → temiz başlık + yıl
export function cleanTitle(raw: string): { title: string; year?: number } {
  const ym = (raw || '').match(/(19|20)\d{2}/);
  const year = ym ? Number(ym[0]) : undefined;
  let s = (raw || '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(1080p|720p|2160p|4k|uhd|hdr|web-?dl|bluray|hdtv|x264|x265|hevc|multi|dual|subbed|dublaj|altyaz[ıi]l?[ıi]?|t[üu]rk[çc]e)\b/gi, ' ')
    .replace(/[._]/g, ' ')
    .split(/\s[-–|]\s/)[0]          // ilk " - " ayracından öncesi
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) s = (raw || '').replace(/[._]/g, ' ').trim();
  return { title: s, year };
}

export async function search(title: string, lang: string, opts: { year?: number; season?: number; episode?: number } = {}): Promise<OsSubtitle[]> {
  try {
    const params = new URLSearchParams();
    params.set('query', title);
    params.set('languages', osLang(lang));
    if (opts.year) params.set('year', String(opts.year));
    if (opts.season != null) params.set('season_number', String(opts.season));
    if (opts.episode != null) params.set('episode_number', String(opts.episode));
    const res = await fetch(baseUrl() + '/api/v1/subtitles?' + params.toString(), { headers: headers(false) });
    if (!res.ok) return [];
    const data = await res.json() as { data?: Array<{ attributes?: Record<string, unknown> }> };
    const out: OsSubtitle[] = [];
    for (const it of data.data || []) {
      const a = (it.attributes || {}) as Record<string, unknown>;
      const file = ((a.files as Array<{ file_id: number; file_name?: string }>) || [])[0];
      if (!file) continue;
      out.push({
        fileId: file.file_id,
        language: String(a.language || lang),
        release: String(a.release || file.file_name || ''),
        downloads: Number(a.download_count || 0),
      });
    }
    out.sort((x, y) => y.downloads - x.downloads);
    return out;
  } catch { return []; }
}

/** file_id'yi indir, cue dizisine çevir. Kota dolarsa/oturum bittiyse hata fırlatır. */
export async function downloadCues(fileId: number): Promise<Cue[]> {
  const res = await fetch(baseUrl() + '/api/v1/download', {
    method: 'POST', headers: headers(true), body: JSON.stringify({ file_id: fileId }),
  });
  if (res.status === 401 || res.status === 403) { Settings.clearOsSession(); throw new Error('AUTH'); }
  if (res.status === 406 || res.status === 429) throw new Error('QUOTA');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json() as { link?: string };
  if (!data.link) throw new Error('NO_LINK');
  const fres = await fetch(data.link);
  const buf = await fres.arrayBuffer();
  const cues = parseSubtitles(decodeSubtitle(buf));
  if (cues.length === 0) throw new Error('EMPTY');
  return cues;
}

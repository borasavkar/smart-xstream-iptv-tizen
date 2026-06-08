// Xtream Codes stream-URL construction — ported 1:1 from the Android app
// (PlayerActivity.buildStreamUrl + AddProfileActivity.cleanUrl). Reused by the
// full app, not just the PoC.

export type StreamType = 'live' | 'movie' | 'series';

export interface BuildStreamUrlParams {
  serverUrl: string;
  username: string;
  password: string;
  streamId: number | string;
  type: StreamType;
  /** container_extension; defaults to 'ts' for live, 'mp4' otherwise */
  extension?: string;
  /** if provided, returned as-is (mirrors Android directSource) */
  directUrl?: string;
}

export function buildStreamUrl(p: BuildStreamUrlParams): string {
  if (p.directUrl) return p.directUrl;

  const base = (p.serverUrl || '').trim().replace(/\/+$/, '');
  const user = p.username ? encodeURIComponent(p.username) : '';
  const pass = p.password ? encodeURIComponent(p.password) : '';
  const ext = p.extension || (p.type === 'live' ? 'ts' : 'mp4');

  if (!user || !pass) {
    return `${base}/live/${p.streamId}.${ext}`;
  }
  switch (p.type) {
    case 'movie':
      return `${base}/movie/${user}/${pass}/${p.streamId}.${ext}`;
    case 'series':
      return `${base}/series/${user}/${pass}/${p.streamId}.${ext}`;
    case 'live':
    default:
      return `${base}/live/${user}/${pass}/${p.streamId}.${ext}`;
  }
}

/** player_api.php base URL builder for catalog/auth calls. */
export function playerApiUrl(serverUrl: string, params: Record<string, string>): string {
  const base = normalizeServerUrl(serverUrl);
  const qs = new URLSearchParams(params).toString();
  return `${base}/player_api.php?${qs}`;
}

/** Cleans a user-entered server URL (adds scheme, strips /player_api.php, trailing slashes). */
export function normalizeServerUrl(raw: string): string {
  let url = (raw || '').trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  url = url.replace(/\/player_api\.php.*$/i, '').replace(/\/get\.php.*$/i, '');
  return url.replace(/\/+$/, '').replace(/\s+/g, '');
}

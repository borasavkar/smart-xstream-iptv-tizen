// Xtream Codes API client (fetch-based), ported from network/ApiService.kt.
// In demo mode it returns mock data instead of hitting the network.
//
// NOTE on networking: on a real Tizen TV, cross-origin requests to IPTV panels
// work because config.xml declares <access origin="*"> + the internet privilege
// (no CORS enforcement for privileged TV apps). In a desktop browser, real
// servers are blocked by CORS — use the demo profile for browser dev.

import type {
  XtreamAuthResponse, LiveCategory, LiveStream, VodCategory, VodStream,
  SeriesStream, SeriesInfoResponse, VodInfoResponse, EpgResponse, ShortEpgResponse,
} from './models';
import { isDemoProfile, MOCK } from './mock';
import { normalizeServerUrl } from './xtream';

export interface Credentials {
  serverUrl: string;
  username: string;
  password: string;
}

export class XtreamClient {
  private readonly base: string;
  private readonly user: string;
  private readonly pass: string;
  private readonly demo: boolean;

  constructor(c: Credentials) {
    this.base = normalizeServerUrl(c.serverUrl);
    this.user = c.username;
    this.pass = c.password;
    this.demo = isDemoProfile(c);
  }

  get isDemo(): boolean { return this.demo; }

  private async call<T>(params: Record<string, string>, mock: T): Promise<T> {
    if (this.demo) return mock;
    const qs = new URLSearchParams({ username: this.user, password: this.pass, ...params });
    const url = `${this.base}/player_api.php?${qs.toString()}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return (await res.json()) as T;
  }

  authenticate(): Promise<XtreamAuthResponse> {
    return this.call<XtreamAuthResponse>({}, MOCK.auth);
  }

  getLiveCategories(): Promise<LiveCategory[]> {
    return this.call<LiveCategory[]>({ action: 'get_live_categories' }, MOCK.liveCategories);
  }

  getLiveStreams(categoryId?: string): Promise<LiveStream[]> {
    const p: Record<string, string> = { action: 'get_live_streams' };
    if (categoryId) p.category_id = categoryId;
    return this.call<LiveStream[]>(p, MOCK.liveStreams);
  }

  getVodCategories(): Promise<VodCategory[]> {
    return this.call<VodCategory[]>({ action: 'get_vod_categories' }, MOCK.vodCategories);
  }

  getVodStreams(): Promise<VodStream[]> {
    return this.call<VodStream[]>({ action: 'get_vod_streams' }, MOCK.vodStreams);
  }

  getSeriesCategories(): Promise<LiveCategory[]> {
    return this.call<LiveCategory[]>({ action: 'get_series_categories' }, MOCK.seriesCategories);
  }

  getSeries(): Promise<SeriesStream[]> {
    return this.call<SeriesStream[]>({ action: 'get_series' }, MOCK.series);
  }

  getSeriesInfo(seriesId: number): Promise<SeriesInfoResponse> {
    return this.call<SeriesInfoResponse>({ action: 'get_series_info', series_id: String(seriesId) }, MOCK.seriesInfo);
  }

  getVodInfo(vodId: number): Promise<VodInfoResponse> {
    return this.call<VodInfoResponse>({ action: 'get_vod_info', vod_id: String(vodId) }, MOCK.vodInfo);
  }

  getEpgTable(): Promise<EpgResponse> {
    return this.call<EpgResponse>({ action: 'get_simple_data_table' }, MOCK.epg);
  }

  getShortEpg(streamId: number, limit = 2): Promise<ShortEpgResponse> {
    return this.call<ShortEpgResponse>(
      { action: 'get_short_epg', stream_id: String(streamId), limit: String(limit) },
      { epg_listings: [] },
    );
  }
}

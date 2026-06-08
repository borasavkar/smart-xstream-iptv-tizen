// Active profile + shared Xtream client + content cache.
// The cache (ports ContentCache.kt) avoids refetching large catalogs as the
// user moves between home / films / series / live screens.
import { Profiles, type Profile } from '../storage/profiles';
import { Settings } from '../storage/settings';
import { XtreamClient } from '../core/api';
import type { LiveStream, VodStream, SeriesStream, LiveCategory, VodCategory } from '../core/models';

export function getActiveProfile(): Profile | null {
  const id = Settings.selectedProfileId();
  return Profiles.byId(id) ?? Profiles.all()[0] ?? null;
}

let cachedClient: XtreamClient | null = null;
let cachedClientId = -2;
export function getClient(): XtreamClient {
  const p = getActiveProfile();
  const id = p?.id ?? -1;
  if (!cachedClient || cachedClientId !== id) {
    cachedClient = new XtreamClient(p ?? { serverUrl: '', username: '', password: '' });
    cachedClientId = id;
  }
  return cachedClient;
}

interface CacheShape {
  profileId: number;
  live?: LiveStream[]; movies?: VodStream[]; series?: SeriesStream[];
  liveCats?: LiveCategory[]; vodCats?: VodCategory[]; seriesCats?: LiveCategory[];
}
let cache: CacheShape = { profileId: -1 };
function ensure(): void {
  const id = getActiveProfile()?.id ?? -1;
  if (cache.profileId !== id) cache = { profileId: id };
}

export const Content = {
  clear(): void { cache = { profileId: -1 }; },
  async liveCategories(): Promise<LiveCategory[]> { ensure(); if (!cache.liveCats) cache.liveCats = await getClient().getLiveCategories(); return cache.liveCats; },
  async liveStreams(): Promise<LiveStream[]> { ensure(); if (!cache.live) cache.live = await getClient().getLiveStreams(); return cache.live; },
  async vodCategories(): Promise<VodCategory[]> { ensure(); if (!cache.vodCats) cache.vodCats = await getClient().getVodCategories(); return cache.vodCats; },
  async movies(): Promise<VodStream[]> { ensure(); if (!cache.movies) cache.movies = await getClient().getVodStreams(); return cache.movies; },
  async seriesCategories(): Promise<LiveCategory[]> { ensure(); if (!cache.seriesCats) cache.seriesCats = await getClient().getSeriesCategories(); return cache.seriesCats; },
  async series(): Promise<SeriesStream[]> { ensure(); if (!cache.series) cache.series = await getClient().getSeries(); return cache.series; },
};

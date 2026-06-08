// TypeScript interfaces for the Xtream Codes player_api.php responses.
// Ported from the Android app's network/Models.kt. Fields use the API's
// snake_case keys; a few values arrive as string OR number (auth, rating),
// so helpers normalize them (mirrors the Kotlin computed properties).

export interface XtreamUserInfo {
  username?: string;
  password?: string;
  message?: string;
  auth?: number | string;
  status?: string;
  exp_date?: string | null;
  is_trial?: string;
}

export interface XtreamServerInfo {
  url?: string;
  port?: string;
  https_port?: string;
  server_protocol?: string;
  timezone?: string;
}

export interface XtreamAuthResponse {
  user_info?: XtreamUserInfo;
  server_info?: XtreamServerInfo;
}

export function isAuthed(r: XtreamAuthResponse | null | undefined): boolean {
  const a = r?.user_info?.auth;
  if (typeof a === 'number') return a === 1;
  if (typeof a === 'string') return a.trim() === '1';
  return false;
}

export interface LiveCategory {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export interface LiveStream {
  stream_id: number;
  name?: string;
  stream_icon?: string;
  category_id?: string;
  epg_channel_id?: string;
  added?: string;
  direct_source?: string;
  directSource?: string;
}

export interface VodCategory {
  category_id: string;
  category_name: string;
}

export interface VodStream {
  stream_id: number;
  name?: string;
  stream_icon?: string;
  category_id?: string;
  container_extension?: string;
  rating?: string | number;
  rating_5based?: string | number;
  added?: string;
  direct_source?: string;
  directSource?: string;
}

export interface VodInfoData {
  movie_image?: string;
  name?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  release_date?: string;
  rating?: string;
  duration?: string;
  youtube_trailer?: string;
}

export interface VodMovieData {
  stream_id: number;
  container_extension?: string;
  name?: string;
  category_id?: string;
  direct_source?: string;
}

export interface VodInfoResponse {
  info?: VodInfoData;
  movie_data?: VodMovieData;
}

export interface SeriesStream {
  series_id: number;
  name?: string;
  stream_icon?: string;
  cover?: string;
  category_id?: string;
  rating?: string | number;
  rating_5based?: string | number;
  last_modified?: string;
  plot?: string;
  genre?: string;
}

export interface Season {
  season_number: number;
  name?: string;
}

export interface EpisodeInfo {
  movie_image?: string;
  duration?: string;
  plot?: string;
}

export interface Episode {
  id: string;
  title?: string;
  container_extension?: string;
  info?: EpisodeInfo;
  season?: number;
  episode_num?: number;
  direct_source?: string;
}

export interface SeriesInfoData {
  name?: string;
  cover?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  rating?: string;
  backdrop_path?: string[];
}

export interface SeriesInfoResponse {
  seasons?: Season[];
  info?: SeriesInfoData;
  episodes?: Record<string, Episode[]>;
}

export interface EpgListing {
  id: string;
  epg_id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
}

export interface EpgResponse {
  epg_listings: EpgListing[];
}

/** get_short_epg — title/description are base64-encoded by Xtream. */
export interface ShortEpgListing {
  id?: string;
  title: string;
  description?: string;
  start: string;
  end: string;
}
export interface ShortEpgResponse {
  epg_listings: ShortEpgListing[];
}

/** Normalize a rating that may be a string or number to a number. */
export function parseRating(v: string | number | undefined): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v); return Number.isNaN(n) ? 0 : n; }
  return 0;
}

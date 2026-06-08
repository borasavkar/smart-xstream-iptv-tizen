// Demo/mock data, ported from the Android app's network/MockData.kt +
// MockInterceptor.kt. Used for the "google_test" demo profile (Google/Samsung
// review safe) and offline UI development. Streams point to public test media.

import type {
  XtreamAuthResponse, LiveCategory, LiveStream, VodCategory, VodStream,
  SeriesStream, SeriesInfoResponse, VodInfoResponse, EpgResponse,
} from './models';

const HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const MP4 = 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-576p.mp4';

/** Demo profile detection — matches MockInterceptor (username contains "google" or url contains "mock"). */
export function isDemoProfile(p: { serverUrl?: string; username?: string }): boolean {
  const u = (p.username || '').toLowerCase();
  const s = (p.serverUrl || '').toLowerCase();
  return u.includes('google') || s.includes('mock');
}

/** Resolve the playable URL for a demo stream (movie/series → MP4, else HLS). */
export function mockStreamUrl(type: string, name?: string): string {
  const n = (name || '').toLowerCase();
  if (type === 'movie' || type === 'series' || n.includes('sintel') || n.includes('tears')) return MP4;
  return HLS;
}

export const MOCK = {
  auth: {
    user_info: {
      username: 'google_test', password: '123456', message: 'Login Success',
      auth: 1, status: 'Active', exp_date: '1893456000', is_trial: '0',
    },
    server_info: { url: 'http://mock.com', port: '80', https_port: '443', server_protocol: 'http', timezone: 'UTC' },
  } as XtreamAuthResponse,

  liveCategories: [{ category_id: '1', category_name: 'Demo Channels', parent_id: 0 }] as LiveCategory[],
  vodCategories: [{ category_id: '2', category_name: 'Demo Movies' }] as VodCategory[],
  seriesCategories: [{ category_id: '3', category_name: 'Demo Series', parent_id: 0 }] as LiveCategory[],

  liveStreams: [{
    stream_id: 1001, name: 'Big Buck Bunny (Live)', category_id: '1', added: '1600000000',
    stream_icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg',
    direct_source: HLS, directSource: HLS,
  }] as LiveStream[],

  vodStreams: [{
    stream_id: 2001, name: 'Sintel (Animation)', category_id: '2', container_extension: 'mp4',
    rating: '7.5', rating_5based: 3.8, added: '1600000000',
    stream_icon: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Sintel_Poster_Paintover_clean.jpg',
    direct_source: MP4, directSource: MP4,
  }] as VodStream[],

  series: [{
    series_id: 3001, name: 'Tears of Steel', category_id: '3', rating: '8.0', rating_5based: 4.0,
    last_modified: '1600000000', genre: 'Sci-Fi', plot: 'Demo Series Plot',
    cover: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Tos-poster.png',
  }] as SeriesStream[],

  seriesInfo: {
    seasons: [{ season_number: 1, name: 'Season 1' }],
    info: {
      name: 'Tears of Steel', plot: 'Sci-fi short film.', genre: 'Sci-Fi', releaseDate: '2012', rating: '8.0',
      cover: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Tos-poster.png', backdrop_path: [],
    },
    episodes: {
      '1': [{
        id: '300101', episode_num: 1, season: 1, title: 'Episode 1', container_extension: 'mp4',
        info: { movie_image: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Tos-poster.png', plot: 'First episode.', duration: '12:00' },
        direct_source: MP4,
      }],
    },
  } as SeriesInfoResponse,

  vodInfo: {
    info: {
      movie_image: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Sintel_Poster_Paintover_clean.jpg',
      name: 'Sintel', plot: 'Demo plot.', cast: 'Demo Cast', director: 'Demo Director',
      genre: 'Animation', release_date: '2010-09-27', rating: '7.5', duration: '14:48', youtube_trailer: '',
    },
    movie_data: { stream_id: 2001, container_extension: 'mp4', name: 'Sintel', category_id: '2', direct_source: MP4 },
  } as VodInfoResponse,

  epg: { epg_listings: [] } as EpgResponse,
};

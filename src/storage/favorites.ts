// Favorites storage, ported from Room (Favorite.kt + FavoriteDao.kt).
export type StreamKind = 'live' | 'vod' | 'series';

export interface Favorite {
  streamId: number;
  streamType: StreamKind;
  name: string;
  image?: string;
  categoryId?: string;
}

const KEY = 'sx_favorites';

function read(): Favorite[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Favorite[]; }
  catch { return []; }
}
function write(list: Favorite[]): void { localStorage.setItem(KEY, JSON.stringify(list)); }

export const Favorites = {
  /** newest first (matches FavoriteDao ORDER BY id DESC) */
  all(): Favorite[] { return read().slice().reverse(); },
  byType(type: StreamKind): Favorite[] { return Favorites.all().filter((f) => f.streamType === type); },
  isFavorite(streamId: number, type: StreamKind): boolean {
    return read().some((f) => f.streamId === streamId && f.streamType === type);
  },
  add(fav: Favorite): void {
    const list = read();
    if (!list.some((f) => f.streamId === fav.streamId && f.streamType === fav.streamType)) {
      list.push(fav);
      write(list);
    }
  },
  remove(streamId: number, type: StreamKind): void {
    write(read().filter((f) => !(f.streamId === streamId && f.streamType === type)));
  },
  /** toggles and returns the new state (true = now favorite) */
  toggle(fav: Favorite): boolean {
    if (Favorites.isFavorite(fav.streamId, fav.streamType)) { Favorites.remove(fav.streamId, fav.streamType); return false; }
    Favorites.add(fav);
    return true;
  },
};

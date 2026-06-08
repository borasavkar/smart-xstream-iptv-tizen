// "AI" recommendation engine, ported 1:1 from utils/RecommendationEngine.kt.
// It's heuristic keyword/category/rating scoring (not real ML — matches the app).
// Favorites/history/preferences are optional; with none, it ranks by rating +
// recency (movies) and rating (series), exactly like the app on a fresh profile.
import type { VodStream, SeriesStream } from './models';
import { parseRating } from './models';

const ADULT = ['adult', 'xxx', 'porn', '+18', 'erotic', 'sex', '18+', 'yetiskin'];
const STOP = new Set(['the', 'a', 'an', 've', 'veya', 'ile', 'bir', 'film', 'dizi', 'izle', 'tr', 'eng', 'dublaj', 'altyazı', 'hd', '4k', 'part', 'bolum']);

export function isAdultContent(name?: string): boolean {
  const s = (name || '').toLowerCase();
  return ADULT.some((k) => s.includes(k));
}

function tokenize(text?: string): string[] {
  if (!text) return [];
  return text.toLowerCase().replace(/[^a-z0-9ğüşıöç ]/g, ' ').split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w) && !ADULT.includes(w));
}

export interface FavLite { streamId: number; streamType: string; name: string; categoryId?: string; }
export interface HistLite { streamId: number; streamType: string; }
export interface PrefLite { keyword: string; score: number; }

export interface RecoInputs {
  history?: HistLite[];
  favorites?: FavLite[];
  preferences?: PrefLite[];
  topCategoryId?: string | null;
  excludedIds?: Set<number>;
}

function favoriteKeywords(favs: FavLite[], type: string): Set<string> {
  const set = new Set<string>();
  for (const f of favs) if (f.streamType === type) for (const k of tokenize(f.name)) set.add(k);
  return set;
}

export function recommendMovies(all: VodStream[], inp: RecoInputs = {}, limit = 15): VodStream[] {
  const history = inp.history ?? [];
  const favorites = inp.favorites ?? [];
  const preferences = inp.preferences ?? [];
  const topCategoryId = inp.topCategoryId ?? null;
  const excluded = inp.excludedIds ?? new Set<number>();

  const interest = favoriteKeywords(favorites, 'vod');
  const recentCutoff = Date.now() / 1000 - 2592000; // 30 days

  const candidates = all.filter((m) => {
    if (excluded.has(m.stream_id)) return false;
    if (history.some((h) => h.streamId === m.stream_id && h.streamType === 'vod')) return false;
    if (favorites.some((f) => f.streamId === m.stream_id && f.streamType === 'vod')) return false;
    return !isAdultContent(m.name);
  });

  const scored = candidates.map((m) => {
    let score = 0;
    const name = (m.name || '').toLowerCase();
    if (m.category_id === topCategoryId) score += 40;
    score += tokenize(m.name).filter((tok) => interest.has(tok)).length * 12;
    if (favorites.some((f) => f.categoryId === m.category_id)) score += 20;
    score += parseRating(m.rating) * 5;
    if ((parseFloat(m.added || '0') || 0) > recentCutoff) score += 20;
    for (const p of preferences) if (name.includes(p.keyword.toLowerCase())) score += p.score * 0.8;
    return { item: m, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.item);
}

export function recommendSeries(all: SeriesStream[], inp: RecoInputs = {}, limit = 10): SeriesStream[] {
  const history = inp.history ?? [];
  const favorites = inp.favorites ?? [];
  const preferences = inp.preferences ?? [];
  const topCategoryId = inp.topCategoryId ?? null;
  const excluded = inp.excludedIds ?? new Set<number>();

  const interest = favoriteKeywords(favorites, 'series');

  const candidates = all.filter((s) => {
    if (excluded.has(s.series_id)) return false;
    if (favorites.some((f) => f.streamId === s.series_id && f.streamType === 'series')) return false;
    if (history.some((h) => h.streamId === s.series_id && h.streamType === 'series')) return false;
    return !isAdultContent(s.name);
  });

  const scored = candidates.map((s) => {
    let score = 0;
    const name = (s.name || '').toLowerCase();
    if (s.category_id === topCategoryId) score += 40;
    score += tokenize(s.name).filter((tok) => interest.has(tok)).length * 12;
    if (favorites.some((f) => f.categoryId === s.category_id)) score += 20;
    score += parseRating(s.rating) * 5;
    for (const p of preferences) if (name.includes(p.keyword.toLowerCase())) score += p.score * 0.8;
    return { item: s, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.item);
}

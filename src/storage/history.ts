// Watch history / interactions, ported from Room (Interaction.kt + InteractionDao.kt).
// One record per (streamId, streamType), upserted with resume position. Feeds
// "Continue watching", episode watched-markers, and the recommendation engine.
export interface Interaction {
  streamId: number;
  streamType: string; // 'live' | 'vod' | 'series'
  categoryId?: string;
  name?: string;
  image?: string;
  durationSeconds: number; // accumulated "score" for top-category ranking
  lastPosition: number;    // ms
  maxDuration: number;     // ms
  isFinished: boolean;
  timestamp: number;
}

const KEY = 'sx_history';

function read(): Interaction[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Interaction[]; }
  catch { return []; }
}
function write(list: Interaction[]): void { localStorage.setItem(KEY, JSON.stringify(list)); }

export interface RecordInput {
  streamId: number;
  streamType: string;
  categoryId?: string;
  name?: string;
  image?: string;
  lastPosition?: number;
  maxDuration?: number;
  isFinished?: boolean;
}

export const History = {
  all(): Interaction[] { return read(); },
  get(streamId: number, type: string): Interaction | undefined {
    return read().find((i) => i.streamId === streamId && i.streamType === type);
  },
  record(input: RecordInput): void {
    const list = read();
    const idx = list.findIndex((i) => i.streamId === input.streamId && i.streamType === input.streamType);
    const prev = idx >= 0 ? list[idx] : undefined;
    const lastPosition = input.lastPosition ?? prev?.lastPosition ?? 0;
    const rec: Interaction = {
      streamId: input.streamId,
      streamType: input.streamType,
      categoryId: input.categoryId ?? prev?.categoryId,
      name: input.name ?? prev?.name,
      image: input.image ?? prev?.image,
      lastPosition,
      maxDuration: input.maxDuration ?? prev?.maxDuration ?? 0,
      isFinished: input.isFinished ?? prev?.isFinished ?? false,
      durationSeconds: Math.max(prev?.durationSeconds ?? 0, Math.floor(lastPosition / 1000)),
      timestamp: Date.now(),
    };
    if (idx >= 0) list[idx] = rec; else list.push(rec);
    write(list);
  },
  /** unfinished movies/series with meaningful progress, newest first */
  recentUnfinished(limit = 15): Interaction[] {
    return read()
      .filter((i) => (i.streamType === 'vod' || i.streamType === 'series') && !i.isFinished && i.lastPosition > 30000)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
  /** most-watched category for a type (AI: getTopCategoryForType) */
  topCategory(type: string): string | null {
    const totals = new Map<string, number>();
    for (const i of read()) {
      if (i.streamType === type && i.categoryId) totals.set(i.categoryId, (totals.get(i.categoryId) || 0) + i.durationSeconds);
    }
    let best: string | null = null;
    let bestVal = -1;
    for (const [cat, val] of totals) if (val > bestVal) { bestVal = val; best = cat; }
    return best;
  },
};

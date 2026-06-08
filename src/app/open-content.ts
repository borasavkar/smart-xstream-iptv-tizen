// Routes a poster selection to the right destination (detail or direct play).
import { nav } from './nav';
import type { PosterItem } from '../ui/components';

export function openContent(i: PosterItem): void {
  if (i.type === 'series') nav.go('seriesdetail', { seriesId: i.id, name: i.name });
  else if (i.type === 'live') nav.go('player', { type: 'live', streamId: i.id, name: i.name, extension: 'ts' });
  else nav.go('filmdetail', { streamId: i.id, name: i.name });
}

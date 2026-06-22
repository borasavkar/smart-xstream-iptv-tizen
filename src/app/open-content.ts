// Routes a poster selection to the right destination (detail or direct play).
import { nav } from './nav';
import type { PosterItem } from '../ui/components';

export function openContent(i: PosterItem): void {
  // Poster görselini detaya taşı: API kapak döndürmese / kullanıcı hemen ♥ bassa
  // bile favori ve detay afişi boş kalmasın.
  if (i.type === 'series') nav.go('seriesdetail', { seriesId: i.id, name: i.name, image: i.image });
  else if (i.type === 'live') nav.go('player', { type: 'live', streamId: i.id, name: i.name, extension: 'ts' });
  else nav.go('filmdetail', { streamId: i.id, name: i.name, image: i.image });
}

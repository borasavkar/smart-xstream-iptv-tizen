// Live TV: channels in a category (ported from ChannelListActivity).
// Selecting a channel plays it directly (live has no detail page).
import { el } from '../ui/dom';
import { screenHeader } from '../ui/header';
import { channelRow } from '../ui/lists';
import { Content } from '../app/session';
import { t } from '../i18n/strings';
import { nav } from '../app/nav';
import type { LiveStream } from '../core/models';
import type { Screen } from '../app/router';

export function channelsScreen(params: Record<string, unknown> = {}): Screen {
  const categoryId = String(params.categoryId ?? '');
  const categoryName = String(params.categoryName ?? t('title_live'));

  const listBox = el('div', { class: 'list' });
  let all: LiveStream[] = [];

  const root = el('div', { class: 'screen list-screen' }, [
    screenHeader(categoryName, { searchHint: t('hint_search_channel'), onSearch: render }),
    listBox,
  ]);

  function render(q = ''): void {
    listBox.innerHTML = '';
    const items = all.filter((c) => (c.name || '').toLowerCase().includes(q));
    if (items.length === 0) { listBox.appendChild(el('p', { class: 'empty', text: t('msg_no_channels_in_category') })); return; }
    // Whole filtered list goes to the player so Up/Down zaps channels.
    const playlist = items.map((c) => ({ streamId: c.stream_id, name: c.name, image: c.stream_icon, directUrl: c.direct_source || c.directSource }));
    items.forEach((ch, i) => {
      listBox.appendChild(channelRow(ch.name || '', ch.stream_icon, () => nav.go('player', {
        type: 'live', streamId: ch.stream_id, name: ch.name, extension: 'ts',
        directUrl: ch.direct_source || ch.directSource, channels: playlist, index: i,
      })));
    });
  }

  return {
    el: root,
    async onMount() {
      const live = await Content.liveStreams();
      all = live.filter((s) => String(s.category_id) === categoryId);
      render();
    },
  };
}

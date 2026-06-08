// Live TV: category list (ported from LiveCategoryActivity).
import { el } from '../ui/dom';
import { screenHeader } from '../ui/header';
import { categoryRow } from '../ui/lists';
import { Content } from '../app/session';
import { t } from '../i18n/strings';
import { nav } from '../app/nav';
import type { Screen } from '../app/router';

export function liveCategoriesScreen(): Screen {
  const listBox = el('div', { class: 'list' });
  let all: Array<{ id: string; name: string }> = [];

  const root = el('div', { class: 'screen list-screen' }, [
    screenHeader(t('title_live'), { searchHint: t('hint_search_category'), onSearch: render }),
    listBox,
  ]);

  function render(q = ''): void {
    listBox.innerHTML = '';
    for (const c of all.filter((c) => c.name.toLowerCase().includes(q))) {
      listBox.appendChild(categoryRow(c.name, () => nav.go('channels', { categoryId: c.id, categoryName: c.name })));
    }
  }

  return {
    el: root,
    async onMount() {
      const cats = await Content.liveCategories();
      all = cats.map((c) => ({ id: c.category_id, name: c.category_name }));
      render();
    },
  };
}

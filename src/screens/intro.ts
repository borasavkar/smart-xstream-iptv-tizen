// Welcome / onboarding screen, ported from IntroActivity + activity_intro.xml.
import { el } from '../ui/dom';
import { t } from '../i18n/strings';
import { Settings } from '../storage/settings';
import { nav } from '../app/nav';
import type { Screen } from '../app/router';

export function introScreen(): Screen {
  const start = el('button', {
    class: 'btn primary big',
    text: t('btn_start_premium'),
    focusable: true,
    onClick: () => { Settings.setIntroSeen(true); nav.replace('home'); },
  });

  const root = el('div', { class: 'screen intro' }, [
    el('div', { class: 'intro-logo', text: '▶' }),
    el('h1', { class: 'intro-title', text: t('intro_main_title') }),
    el('p', { class: 'intro-sub', text: t('intro_sub_title') }),
    el('ul', { class: 'intro-feats' }, [
      el('li', { text: '🤖  ' + t('feat_ai_stability') }),
      el('li', { text: '⚡  ' + t('feat_4k_speed') }),
      el('li', { text: '📺  ' + t('feat_no_buffer') }),
    ]),
    start,
  ]);

  return { el: root, onMount() { start.focus(); } };
}

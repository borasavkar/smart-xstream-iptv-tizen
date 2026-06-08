// Main settings (Phase 6 + player prefs): UI language, preferred audio/subtitle
// language (+ subtitle Off), subtitle style, and video-quality preference.
// Selected content opens with these preferences (applied by the player).
import { el } from '../ui/dom';
import { screenHeader } from '../ui/header';
import { t, languages } from '../i18n/strings';
import { Settings } from '../storage/settings';
import type { Screen } from '../app/router';

export function settingsScreen(): Screen {
  const body = el('div', { class: 'settings-body' });
  const root = el('div', { class: 'screen list-screen settings-screen' }, [screenHeader(t('settings_title')), body]);

  const pill = (label: string, active: boolean, onSelect: () => void): HTMLElement =>
    el('button', { class: 'opt-pill' + (active ? ' active' : ''), focusable: true, text: label, onClick: onSelect });

  const section = (heading: string, rows: HTMLElement[]): HTMLElement =>
    el('section', { class: 'settings-section' }, [el('h2', { class: 'settings-h', text: heading }), el('div', { class: 'opt-row' }, rows)]);

  function render(): void {
    body.innerHTML = '';

    // Interface language (reloads to re-render the whole app)
    body.appendChild(section(t('settings_ui_language'), languages.map((l) =>
      pill(l.name, l.code === Settings.uiLang(), () => { if (l.code !== Settings.uiLang()) { Settings.setUiLang(l.code); location.reload(); } }))));

    // Preferred audio language
    body.appendChild(section(t('preferred_audio'), languages.map((l) =>
      pill(l.name, l.code === Settings.audioLang(), () => { Settings.setAudioLang(l.code); render(); }))));

    // Preferred subtitle language (+ Off)
    const subRows = [pill(t('option_off'), !Settings.subtitleEnabled(), () => { Settings.setSubtitleEnabled(false); render(); })];
    for (const l of languages) {
      subRows.push(pill(l.name, Settings.subtitleEnabled() && l.code === Settings.subtitleLang(),
        () => { Settings.setSubtitleEnabled(true); Settings.setSubtitleLang(l.code); render(); }));
    }
    body.appendChild(section(t('preferred_subtitle'), subRows));

    // Subtitle style
    body.appendChild(section(t('subtitle_style'), [
      pill(t('size_small'), Settings.subSize() === 's', () => { Settings.setSubSize('s'); render(); }),
      pill(t('size_medium'), Settings.subSize() === 'm', () => { Settings.setSubSize('m'); render(); }),
      pill(t('size_large'), Settings.subSize() === 'l', () => { Settings.setSubSize('l'); render(); }),
      pill(`${t('sub_bg')}: ${Settings.subBg() ? t('opt_on') : t('option_off')}`, Settings.subBg(), () => { Settings.setSubBg(!Settings.subBg()); render(); }),
    ]));

    // Video quality preference
    const q = Settings.videoQuality();
    const qPill = (label: string, val: string): HTMLElement => pill(label, q === val, () => { Settings.setVideoQuality(val); render(); });
    body.appendChild(section(t('video_quality_pref'), [
      qPill(t('quality_auto'), 'auto'), qPill('4K', '2160'), qPill('1080p', '1080'), qPill('720p', '720'), qPill('480p', '480'),
    ]));
  }

  return { el: root, onMount() { render(); } };
}

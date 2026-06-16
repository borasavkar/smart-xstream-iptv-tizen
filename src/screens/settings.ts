// Main settings (Phase 6 + player prefs): UI language, preferred audio/subtitle
// language (+ subtitle Off), subtitle style, and video-quality preference.
// Selected content opens with these preferences (applied by the player).
import { el } from '../ui/dom';
import { screenHeader } from '../ui/header';
import { t, languages } from '../i18n/strings';
import { Settings } from '../storage/settings';
import * as OS from '../core/opensubtitles';
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

    // OpenSubtitles account (dış altyazı): kullanıcı kendi hesabıyla girer.
    body.appendChild(renderOsSection());
  }

  function osField(placeholder: string, type = 'text'): HTMLInputElement {
    return el('input', {
      class: 'fld', type, focusable: true, placeholder,
      attrs: { autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' },
    });
  }

  function renderOsSection(): HTMLElement {
    const rows: HTMLElement[] = [];
    if (OS.isLoggedIn()) {
      rows.push(el('div', { class: 'os-status', text: t('os_connected', Settings.osUser()) }));
      rows.push(pill(t('os_logout'), false, () => { OS.logout(); render(); }));
      rows.push(pill(`${t('external_subs_auto')}: ${Settings.externalSubs() ? t('opt_on') : t('option_off')}`,
        Settings.externalSubs(), () => { Settings.setExternalSubs(!Settings.externalSubs()); render(); }));
      return el('section', { class: 'settings-section' }, [el('h2', { class: 'settings-h', text: t('os_account') }), el('div', { class: 'opt-row' }, rows)]);
    }
    const user = osField(t('hint_username'));
    const pass = osField(t('hint_password'), 'password');
    const status = el('div', { class: 'os-status-msg' });
    let busy = false;
    const doLogin = (): void => {
      if (busy) return;
      const u = user.value.trim(); const p = pass.value;
      if (!u || !p) { status.textContent = t('msg_fill_all_fields'); return; }
      busy = true; status.textContent = t('status_connecting');
      void OS.login(u, p).then((r) => { busy = false; if (r.ok) render(); else status.textContent = r.message || t('os_bad_login'); });
    };
    const loginBtn = pill(t('os_login'), false, doLogin);

    // TV klavyesi "Bitti"/Enter ile sıradaki alana geç (profil formuyla aynı):
    // metin kutusunda SAĞ ok imleci taşıdığından, alanlar arası geçiş bu tuşla olur.
    // Odak blur ile kapatılıp gecikmeyle taşınır ki SmartThings klavyesi yeniden bağlansın.
    const fields = [user, pass];
    const typed = new Set<HTMLInputElement>();
    fields.forEach((inp, idx) => {
      inp.addEventListener('focus', () => typed.delete(inp));
      inp.addEventListener('input', () => typed.add(inp));
      inp.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.keyCode !== 65376 && e.keyCode !== 13) return;
        if (e.keyCode === 13 && !typed.has(inp)) return;
        e.preventDefault(); e.stopPropagation();
        inp.blur();
        const next: HTMLElement = fields[idx + 1] ?? loginBtn;
        window.setTimeout(() => {
          next.focus();
          if (next instanceof HTMLInputElement) { const end = next.value.length; try { next.setSelectionRange(end, end); } catch { /* */ } }
        }, 400);
      });
    });

    return el('section', { class: 'settings-section' }, [
      el('h2', { class: 'settings-h', text: t('os_account') }),
      el('p', { class: 'settings-hint', text: t('os_signin_hint') }),
      el('div', { class: 'os-login-form' }, [user, pass, loginBtn]),
      status,
    ]);
  }

  return { el: root, onMount() { render(); } };
}

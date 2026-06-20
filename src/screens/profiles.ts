// Profile select / add / edit / delete (the login flow), ported from
// MainActivity's profile dialogs + AddProfileActivity. Non-demo profiles are
// verified by calling authenticate() before saving (demo bypasses, like Android).
import { el, toast } from '../ui/dom';
import { t } from '../i18n/strings';
import { Profiles, type Profile } from '../storage/profiles';
import { Settings } from '../storage/settings';
import { XtreamClient } from '../core/api';
import { isAuthed } from '../core/models';
import { normalizeServerUrl } from '../core/xtream';
import { nav } from '../app/nav';
import type { Screen } from '../app/router';

const DEMO_USER = 'google_test';

export function profilesScreen(): Screen {
  const title = el('h1', { text: t('title_select_profile') });
  const body = el('div', { class: 'profiles-body' });
  const root = el('div', { class: 'screen profiles' }, [
    el('header', { class: 'sub-top' }, [title]),
    body,
  ]);

  function selectProfile(p: Profile): void {
    Settings.setSelectedProfileId(p.id);
    if (p.username !== DEMO_USER) Settings.setDemoMode(false);
    toast(t('msg_profile_switched', p.profileName));
    nav.back();
  }

  function renderList(): void {
    title.textContent = t('title_select_profile');
    body.innerHTML = '';
    const list = Profiles.all();
    if (list.length === 0) { renderForm(null); return; }

    for (const p of list) {
      body.appendChild(el('div', { class: 'profile-row' }, [
        el('button', { class: 'profile-name', focusable: true, text: p.profileName, onClick: () => selectProfile(p) }),
        el('button', { class: 'profile-edit', focusable: true, text: '✎', onClick: () => renderForm(p) }),
      ]));
    }
    body.appendChild(el('button', {
      class: 'btn add-profile', focusable: true, text: '＋ ' + t('btn_add_new'),
      onClick: () => renderForm(null),
    }));
    focusFirstIn(body);
  }

  function renderForm(editing: Profile | null): void {
    title.textContent = editing ? t('title_edit_profile') : t('title_add_profile');
    body.innerHTML = '';
    const noReal = !Profiles.all().some((p) => p.username !== DEMO_USER);

    // Etiketli, TV/telefon klavyesi dostu alan. Otomatik büyük harf, düzeltme ve
    // tamamlama kapalı: SmartThings klavyesi kullanıcı adı / şifre / URL'yi
    // sessizce değiştirmesin; yapıştırılan metin de olduğu gibi kalsın.
    const createField = (labelKey: string, val: string, inputType: string = 'text', isLast: boolean = false) => {
      const inp = el('input', {
        class: 'fld',
        type: inputType,
        focusable: true,
        placeholder: t(labelKey),
        value: val,
        attrs: {
          'autocomplete': 'off',
          'autocapitalize': 'off',
          'autocorrect': 'off',
          'spellcheck': 'false',
          'enterkeyhint': isLast ? 'done' : 'next', // TV klavyesine sıradaki işleme geçme komutu verir
        },
      });
      const wrap = el('div', { class: 'fld-wrap' }, [
        el('label', { class: 'fld-label', text: t(labelKey) }),
        inp,
      ]);
      return { wrap, inp };
    };

    const nameFld = createField('hint_profile_name', editing?.profileName ?? '');
    const userFld = createField('hint_username', editing?.username ?? '');
    const passFld = createField('hint_password', editing?.password ?? '', 'password');
    const urlFld = createField('hint_server_url', editing?.serverUrl ?? '', 'text', true);
    urlFld.inp.setAttribute('inputmode', 'url'); // telefon klavyesinde / : . tuşlu URL düzeni

    const save = el('button', { class: 'btn primary', focusable: true, text: editing ? t('btn_update') : t('btn_save') });
    save.addEventListener('click', () => { void doSave(editing, nameFld.inp, userFld.inp, passFld.inp, urlFld.inp, save); });

    const cancel = el('button', { class: 'btn', focusable: true, text: t('btn_cancel'), onClick: () => renderList() });
    const actions = el('div', { class: 'form-actions' }, [save, cancel]);

    // Gerçek <form>: Tizen klavyesi Enter'ı submit'e çevirdiğinde sayfanın
    // yenilenmemesi için submit durduruluyor.
    const form = el('form', { class: 'form' }, [
      nameFld.wrap, userFld.wrap, passFld.wrap, urlFld.wrap, actions,
    ]);
    form.addEventListener('submit', (e: Event) => { e.preventDefault(); });

    // NOT: Otomatik alan-geçişi BİLEREK yok. TV/SmartThings klavyesinde "Bitti"
    // deyince odak yerinde kalır (klavye kapanır); kullanıcı kumandanın yön/OK
    // tuşlarıyla bir sonraki alana geçer. Böylece yeni alana gelip OK'e basınca
    // SmartThings klavyesi taze açılır — otomatik geçiş bu oturumu bozuyordu.

    if (editing) {
      // Two-tap confirm so a saved profile is never deleted by accident.
      let armed = false;
      const delBtn = el('button', { class: 'btn danger', focusable: true, text: t('btn_delete') });
      delBtn.addEventListener('click', () => {
        if (!armed) { armed = true; delBtn.textContent = t('btn_confirm'); return; }
        doDelete(editing);
      });
      actions.appendChild(delBtn);
    }

    body.appendChild(form);

    // İlk kurulumda demo profili tek tuşla eklenebilir; form kutuları boş başlar.
    if (!editing && noReal) {
      actions.appendChild(el('button', { class: 'btn', focusable: true, text: t('load_demo_data'), onClick: saveDemo }));
    }

    requestAnimationFrame(() => nameFld.inp.focus());
  }

  function saveDemo(): void {
    const demo = Profiles.insert({ profileName: 'Demo Mode', username: DEMO_USER, password: '123456', serverUrl: 'http://mock.com', isM3u: false });
    Settings.setSelectedProfileId(demo.id);
    Settings.setDemoMode(true);
    nav.back();
  }

  async function doSave(
    editing: Profile | null,
    name: HTMLInputElement, user: HTMLInputElement, pass: HTMLInputElement, url: HTMLInputElement,
    save: HTMLButtonElement,
  ): Promise<void> {
    const pn = name.value.trim() || t('default_profile_name');
    const un = user.value.trim();
    const pw = pass.value.trim();
    const su = normalizeServerUrl(url.value);
    if (!un || !su) { toast(t('msg_fill_all_fields')); return; }

    const persist = (): void => {
      if (editing) {
        Profiles.update({ ...editing, profileName: pn, username: un, password: pw, serverUrl: su });
        Settings.setSelectedProfileId(editing.id);
        toast(t('msg_profile_updated'));
      } else {
        const created = Profiles.insert({ profileName: pn, username: un, password: pw, serverUrl: su, isM3u: false });
        Settings.setSelectedProfileId(created.id);
        toast(t('msg_profile_saved'));
      }
      if (un !== DEMO_USER) Settings.setDemoMode(false);
      nav.back();
    };

    if (un === DEMO_USER) { persist(); return; } // demo bypass (matches Android)

    save.setAttribute('disabled', '');
    save.textContent = t('status_connecting');
    const restore = (): void => { save.removeAttribute('disabled'); save.textContent = editing ? t('btn_update') : t('btn_save'); };
    try {
      const auth = await new XtreamClient({ serverUrl: su, username: un, password: pw }).authenticate();
      if (isAuthed(auth)) persist();
      else { toast(auth.user_info?.message || t('error_login_failed_check')); restore(); }
    } catch {
      toast(t('error_network_connection'));
      restore();
    }
  }

  function doDelete(p: Profile): void {
    Profiles.remove(p.id);
    if (Settings.selectedProfileId() === p.id) Settings.setSelectedProfileId(-1);
    toast(t('msg_profile_deleted'));
    renderList();
  }

  return { el: root, onMount() { renderList(); } };
}

function focusFirstIn(container: HTMLElement): void {
  requestAnimationFrame(() => (container.querySelector('[data-focusable]') as HTMLElement | null)?.focus());
}

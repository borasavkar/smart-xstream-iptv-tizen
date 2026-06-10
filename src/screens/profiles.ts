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

    // 1. Etiketli ve SmartThings tam uyumlu Input oluşturucu
   const createField = (labelKey: string, val: string, inputType: string = 'text', isLast: boolean = false) => {
      const inp = el('input', {
        class: 'fld',
        type: inputType,
        focusable: true,
        placeholder: t(labelKey),
        value: editing ? val : '',
        attrs: {
          'autocomplete': 'off',
          'spellcheck': 'false',
          'enterkeyhint': isLast ? 'done' : 'next' // TV klavyesine sıradaki işleme geçme komutu verir
        }
      });
      const wrap = el('div', { class: 'fld-wrap' }, [
        el('label', { class: 'fld-label', text: t(labelKey) }),
        inp
      ]);
      return { wrap, inp };
    };

    const nameFld = createField('hint_profile_name', editing?.profileName ?? '');
    const userFld = createField('hint_username', editing?.username ?? '');
    const passFld = createField('hint_password', editing?.password ?? '', 'password');
    const urlFld  = createField('hint_server_url', editing?.serverUrl ?? '', 'text', true); // Son alan

    const save = el('button', { class: 'btn primary', focusable: true, text: editing ? t('btn_update') : t('btn_save') });
    save.addEventListener('click', () => { 
      void doSave(editing, nameFld.inp as HTMLInputElement, userFld.inp as HTMLInputElement, passFld.inp as HTMLInputElement, urlFld.inp as HTMLInputElement, save); 
    });
    
    const cancel = el('button', { class: 'btn', focusable: true, text: t('btn_cancel'), onClick: () => renderList() });
    const actions = el('div', { class: 'form-actions' }, [save, cancel]);

// 'div' yerine 'form' etiketi kullanıyoruz ve HTML5 native davranışına izin veriyoruz
// 1. Form Kapsayıcısı ve Submit Dinleyicisi (onSubmit hatasının çözümü)
    const form = el('form', { class: 'form' }, [
      nameFld.wrap, userFld.wrap, passFld.wrap, urlFld.wrap, actions
    ]);
    
    // Tizen klavyesinin sayfayı yenilemesini engellemek için submit olayını native olarak durduruyoruz
    form.addEventListener('submit', (e: Event) => { 
      e.preventDefault(); 
    });

    // 2. Tizen & SmartThings İlerleme Algoritması (inputs çakışmasını önlemek için isim formFields yapıldı)
    const formFields = [nameFld.inp, userFld.inp, passFld.inp, urlFld.inp];
    formFields.forEach((inp, idx) => {
      inp.addEventListener('keydown', (e: KeyboardEvent) => {
        // 65376: Tizen Bitti Tuşu | 13: Harici Klavye Enter Tuşu
        if (e.keyCode === 65376 || e.keyCode === 13) {
          e.preventDefault();
          const nextTarget = formFields[idx + 1] || save;
          nextTarget.focus();
        }
      });
    });
// 2. SmartThings çakışmasını engelleyen optimize edilmiş Otomatik İlerleme
    const inputs = [nameFld.inp, userFld.inp, passFld.inp, urlFld.inp];
    inputs.forEach((inp, idx) => {
      inp.addEventListener('keydown', (e: KeyboardEvent) => {
        // 65376: Tizen Bitti Tuşu | 13: Harici Klavye Enter Tuşu
        if (e.keyCode === 65376 || e.keyCode === 13) {
          e.preventDefault();
          
          // 1. Mevcut oturumu TV ve SmartThings tarafında temizce sonlandır
          inp.blur(); 
          
          const nextTarget = inputs[idx + 1] || save;
          
          // 2. Senkronizasyonun tamamlanması için bekle ve sadece çerçeveyi (odağı) taşı
          setTimeout(() => {
            nextTarget.focus();
          }, 400); 
        }
      });
    });

    if (editing) {
      let armed = false;
      const delBtn = el('button', { class: 'btn danger', focusable: true, text: t('btn_delete') });
      delBtn.addEventListener('click', () => {
        if (!armed) { armed = true; delBtn.textContent = t('btn_confirm'); return; }
        doDelete(editing);
      });
      actions.appendChild(delBtn);
    }

    body.appendChild(form);

    // İlk kurulum aşaması için eklenen Demo butonu bırakıldı, ancak form kutularının doldurulması iptal edildi.
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
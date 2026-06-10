// Full-screen player overlay, matching the Android app:
//   • Top: back (left) · resolution + speed pills (center) · ♥ + clock (right)
//   • Center: ⏮ ⏪10 ⏯ ⏩10 ⏭  (VOD/series)  /  ⏮ ⏯ ⏭  (live channels)
//   • Bottom: progress bar + times (left) · ⚙ settings (right)
//   • Focus starts on ⏯ and stays in sync (router honours [data-initial-focus]);
//     ←/→ move between controls, ↑ → back, ↓ → settings, Return exits.
//   • Hold ◀/▶ to fast-seek with accelerating speed; styled subtitles; resume.
// Uses explicit top/left/right/bottom (not `inset`) for older Tizen Chromium.
import { el } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { AVPlayer, type PlaybackState, type TrackType } from '../player/AVPlayer';
import { buildStreamUrl, type StreamType } from '../core/xtream';
import { getActiveProfile, getClient } from '../app/session';
import { Settings } from '../storage/settings';
import { Favorites, type StreamKind } from '../storage/favorites';
import { History } from '../storage/history';
import { t } from '../i18n/strings';
import { KEY, moveFocus } from '../input/remote';
import { nav } from '../app/nav';
import type { Screen } from '../app/router';

interface ChannelLite { streamId: number; name?: string; image?: string; directUrl?: string; }
interface PlayerParams {
  streamId: number; type: StreamType; extension?: string; name?: string; directUrl?: string;
  image?: string; categoryId?: string; channels?: ChannelLite[]; index?: number;
}

const A3TO2: Record<string, string> = { tur: 'tr', eng: 'en', ger: 'de', deu: 'de', fra: 'fr', fre: 'fr', rus: 'ru', ara: 'ar', spa: 'es', ita: 'it', por: 'pt', dut: 'nl', pol: 'pl' };
const norm = (l?: string): string => { const x = (l || '').toLowerCase(); return A3TO2[x] || x.slice(0, 2); };
const b64 = (s: string): string => { try { return decodeURIComponent(escape(window.atob(s))); } catch { try { return window.atob(s); } catch { return s; } } };
const fmt = (ms: number): string => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0'); };

export function playerScreen(params: Record<string, unknown> = {}): Screen {
  const p = params as unknown as PlayerParams;
  const profile = getActiveProfile();
  const isLive = p.type === 'live';
  const tracks = p.type === 'movie' || p.type === 'series';
  const favType: StreamKind = p.type === 'movie' ? 'vod' : p.type;

  let streamId = p.streamId;
  let name = p.name || '';
  const channels = p.channels ?? [];
  let index = p.index ?? 0;

// ---- top bar ---- (Orijinal hali, dokunulmadı)
  const backBtn = el('button', { class: 'pc-iconbtn', focusable: true, html: ICONS.back(), onClick: exitPlayer });
  const resEl = el('span', { class: 'pc-pill pc-res' });
  const speedEl = el('span', { class: 'pc-pill pc-speed' });
  const clockEl = el('span', { class: 'pc-pill pc-clock' });
  const epgEl = el('div', { class: 'pc-epg' });
  const pcTop = el('div', { class: 'pc-top' }, [
    el('div', { class: 'pc-tl' }, [backBtn, epgEl]),
    el('div', { class: 'pc-tc' }, [resEl, speedEl]),
    el('div', { class: 'pc-tr' }, [clockEl]), // Favori butonu buradan alındı
  ]);

  // ---- transport & actions ---- (Ortalanmış oynatma kontrolleri)
  const tbtn = (glyph: string, cls: string, onClick: () => void): HTMLElement => el('button', { class: 'tbtn ' + cls, focusable: true, text: glyph, onClick });
  const playBtn = el('button', { class: 'tbtn tbtn-play', focusable: true, text: '⏸', attrs: { 'data-initial-focus': '' }, onClick: toggle });
  const transport: HTMLElement[] = isLive
    ? [tbtn('⏮', 'tbtn-side', () => switchTo(index - 1)), playBtn, tbtn('⏭', 'tbtn-side', () => switchTo(index + 1))]
    : [tbtn('⏮', 'tbtn-side', () => seekRelative(-300000)), tbtn('⏪', 'tbtn-seek', () => seekRelative(-10000)), playBtn, tbtn('⏩', 'tbtn-seek', () => seekRelative(10000)), tbtn('⏭', 'tbtn-side', () => seekRelative(300000))];

  const favBtn = el('button', { class: 'pc-iconbtn', focusable: true });
  const gearBtn = el('button', { class: 'pc-iconbtn pc-gear', focusable: true, html: ICONS.gear(), onClick: openSettingsMenu });

  // ---- bottom (YouTube Style) ----
  const barFill = el('div', { class: 'bar-fill' });
  const curT = el('span', { class: 'prog-t', text: '0:00' });
  const durT = el('span', { class: 'prog-t', text: '0:00' });
  const progress = el('div', { class: 'pc-prog', focusable: true }, [curT, el('div', { class: 'prog-bar' }, [barFill]), durT]);

  const pcControlsRow = el('div', { class: 'pc-controls-row' }, [
    el('div', { class: 'pc-cr-left' }, [favBtn]),          // En solda Favori
    el('div', { class: 'pc-cr-center' }, transport),       // Ortada Oynat/İleri/Geri
    el('div', { class: 'pc-cr-right' }, [gearBtn]),        // En sağda Ayarlar
  ]);

  // Gezinme çubuğu üstte, oynatma kontrolleri altta olacak şekilde alt barı oluşturuyoruz
  const pcBottom = el('div', { class: 'pc-bottom' }, isLive ? [el('div', { class: 'pc-prog' }), pcControlsRow] : [progress, pcControlsRow]);

  const controls = el('div', { class: 'player-controls' }, [pcTop, pcBottom]);
  const menu = el('div', { class: 'player-menu' });
  const seekHud = el('div', { class: 'seek-hud' });
  const subtitle = el('div', { class: 'player-subtitle' });
  const status = el('div', { class: 'player-status-c' });
  const dbg = el('div', { class: 'pc-dbg' }); // temporary remote-key debug readout
  const root = el('div', { class: 'screen player-screen' }, [subtitle, seekHud, status, dbg, controls, menu]);

  // ---- state ----
  let paused = false, resumeMs = 0, resumed = false, lastSaved = 0;
  let curMs = 0, durMs = 0;
  let hideTimer = 0, hudTimer = 0;
  let menuOpen = false, prefsApplied = false;
  let seeking = false, seekTarget = 0, seekPresses = 0, seekTimer = 0;
  let zone: HTMLElement[] = [], zoneIdx = 0;

  if (tracks) { const prev = History.get(streamId, p.type); if (prev && !prev.isFinished && prev.lastPosition > 30000) resumeMs = prev.lastPosition; }
  const save = (cur: number, dur: number, fin: boolean): void => History.record({ streamId, streamType: p.type, categoryId: p.categoryId, name, image: p.image, lastPosition: cur, maxDuration: dur, isFinished: fin });

  const player = new AVPlayer(
    document.getElementById('av-player'),
    document.getElementById('av-fallback') as HTMLVideoElement | null,
    {
      onState: (s) => { setStatus(s); if (s === 'playing') { paused = false; setPlayGlyph(); onPlaying(); } if (s === 'paused') { paused = true; setPlayGlyph(); } },
      onTime: (cur, dur) => {
        curMs = cur; durMs = dur;
        if (!seeking) updateProgress();
        if (tracks && cur > 0) { const fin = dur > 0 && cur / dur > 0.95; const now = Date.now(); if (fin || now - lastSaved > 5000) { lastSaved = now; save(cur, dur, fin); } }
      },
      onSubtitle: (text) => { if (Settings.subtitleEnabled()) { subtitle.textContent = text || ''; subtitle.style.display = text ? 'inline-block' : 'none'; } },
    },
  );

  function renderFav(): void { favBtn.innerHTML = ICONS.heart(Favorites.isFavorite(streamId, favType) ? '#FF0099' : '#E8EEF4'); }
  favBtn.addEventListener('click', () => { Favorites.toggle({ streamId, streamType: favType, name, image: p.image, categoryId: p.categoryId }); renderFav(); });
  renderFav();

  function setPlayGlyph(): void { playBtn.textContent = paused ? '▶' : '⏸'; }
  function setStatus(s: PlaybackState): void {
    const map: Record<string, string> = { opening: 'Açılıyor…', buffering: 'Tamponlanıyor…', error: 'Oynatma hatası' };
    status.textContent = map[s] || ''; status.style.display = map[s] ? 'block' : 'none';
  }
  function exitPlayer(): void { player.stop(); document.body.classList.remove('playing'); nav.back(); }

  function onPlaying(): void {
    if (resumeMs > 0 && !resumed) { resumed = true; player.seekTo(resumeMs); }
    if (!prefsApplied) { prefsApplied = true; window.setTimeout(applyPreferences, 700); }
    styleSubtitle();
  }
  function applyPreferences(): void {
    const a = player.getTracks('AUDIO').find((tr) => norm(tr.lang) === norm(Settings.audioLang()));
    if (a) player.selectTrack('AUDIO', a.index);
    if (Settings.subtitleEnabled()) {
      const s = player.getTracks('TEXT').find((tr) => norm(tr.lang) === norm(Settings.subtitleLang()));
      if (s) player.selectTrack('TEXT', s.index);
    } else { player.disableSubtitles(); subtitle.style.display = 'none'; }
    const q = Settings.videoQuality();
    if (q !== 'auto') {
      const want = Number(q);
      const vids = player.getTracks('VIDEO').filter((v) => v.height).sort((x, y) => (y.height || 0) - (x.height || 0));
      const pick = vids.find((v) => (v.height || 0) <= want) || vids[vids.length - 1];
      if (pick) player.selectTrack('VIDEO', pick.index);
    }
  }

  function refreshHud(): void {
    const info = player.getPlaybackInfo();
    resEl.textContent = info.width && info.height ? `${info.width}x${info.height}` : '';
    speedEl.textContent = info.bandwidthKbps > 0 ? `${(info.bandwidthKbps / 1000).toFixed(1)} Mbps` : '0 KB/s';
    clockEl.textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  function updateProgress(): void {
    if (isLive || durMs <= 0) { progress.style.visibility = 'hidden'; return; }
    progress.style.visibility = 'visible';
    barFill.style.width = Math.min(100, (curMs / durMs) * 100) + '%';
    curT.textContent = fmt(curMs); durT.textContent = fmt(durMs);
  }
  function styleSubtitle(): void {
    const sz = Settings.subSize();
    subtitle.style.fontSize = sz === 's' ? '30px' : sz === 'l' ? '54px' : '42px';
    subtitle.style.color = Settings.subColor();
    subtitle.style.background = Settings.subBg() ? 'rgba(0,0,0,.6)' : 'transparent';
  }

  // ---- focus ----
  function setZone(list: HTMLElement[], initial?: HTMLElement): void { zone = list; zoneIdx = initial ? Math.max(0, list.indexOf(initial)) : 0; requestAnimationFrame(() => zone[zoneIdx]?.focus()); }
  function moveZone(d: number): void { if (!zone.length) return; zoneIdx = (zoneIdx + d + zone.length) % zone.length; zone[zoneIdx].focus(); }
  function controlsVisible(): boolean { return controls.classList.contains('show'); }
  function showControls(): void {
  controls.classList.add('show'); refreshHud(); updateProgress();
  clearInterval(hudTimer); hudTimer = window.setInterval(refreshHud, 1000);
  if (!menuOpen) {
    const ae = document.activeElement as HTMLElement | null;
    // Eğer odak halihazırda oynatıcı kontrollerinin içinde değilse oynat butonuna odaklan
    if (!ae || !controls.contains(ae)) {
      requestAnimationFrame(() => playBtn.focus());
    }
  }
  resetHide();
}
  function hideControls(): void { controls.classList.remove('show'); clearInterval(hudTimer); }
  function resetHide(): void { clearTimeout(hideTimer); hideTimer = window.setTimeout(() => { if (!menuOpen) hideControls(); }, 7000); }

  // ---- menus ----
  interface Opt { label: string; active?: boolean; apply: () => void; }
  function openMenu(heading: string, opts: Opt[]): void {
    if (opts.length === 0) return;
    menu.innerHTML = '';
    menu.appendChild(el('h3', { class: 'menu-head', text: heading }));
    const items = opts.map((o) => el('button', { class: 'menu-item' + (o.active ? ' active' : ''), focusable: true, onClick: o.apply }, [
      el('span', { text: o.label }), el('span', { class: 'ep-watched', text: o.active ? '✔' : '' }),
    ]));
    items.forEach((i) => menu.appendChild(i));
    menuOpen = true; controls.classList.remove('show'); clearTimeout(hideTimer);
    menu.classList.add('show'); setZone(items);
  }
  function closeMenu(): void { menuOpen = false; menu.classList.remove('show'); menu.innerHTML = ''; showControls(); }
  function openSettingsMenu(): void {
    openMenu(t('menu_settings'), [
      { label: '🔊 ' + t('track_audio'), apply: () => openTrackMenu('AUDIO', t('track_audio')) },
      { label: '💬 ' + t('track_subtitle'), apply: openSubtitleMenu },
      { label: '🅰 ' + t('subtitle_style'), apply: openStyleMenu },
      { label: '⚙ ' + t('track_quality'), apply: openQualityMenu },
    ]);
  }
  function openTrackMenu(type: TrackType, heading: string): void {
    const list = player.getTracks(type);
    if (list.length === 0) { flash(t('msg_no_options')); return; }
    openMenu(heading, list.map((tr) => ({ label: tr.label, apply: () => { player.selectTrack(type, tr.index); closeMenu(); } })));
  }
  function openSubtitleMenu(): void {
    const opts: Opt[] = [{ label: t('option_off'), active: !Settings.subtitleEnabled(), apply: () => { Settings.setSubtitleEnabled(false); player.disableSubtitles(); subtitle.style.display = 'none'; closeMenu(); } }];
    for (const tr of player.getTracks('TEXT')) opts.push({ label: tr.label, apply: () => { Settings.setSubtitleEnabled(true); player.selectTrack('TEXT', tr.index); closeMenu(); } });
    openMenu(t('track_subtitle'), opts);
  }
  function openQualityMenu(): void {
    const opts: Opt[] = [{ label: t('quality_auto'), active: Settings.videoQuality() === 'auto', apply: () => { Settings.setVideoQuality('auto'); closeMenu(); } }];
    for (const v of player.getTracks('VIDEO').filter((x) => x.height).sort((a, b) => (b.height || 0) - (a.height || 0))) {
      opts.push({ label: `${v.height}p`, apply: () => { Settings.setVideoQuality(String(v.height)); player.selectTrack('VIDEO', v.index); closeMenu(); } });
    }
    if (opts.length === 1) { flash(t('msg_no_options')); return; }
    openMenu(t('track_quality'), opts);
  }
  function openStyleMenu(): void {
    const sz = Settings.subSize();
    openMenu(t('subtitle_style'), [
      { label: t('size_small'), active: sz === 's', apply: () => { Settings.setSubSize('s'); styleSubtitle(); openStyleMenu(); } },
      { label: t('size_medium'), active: sz === 'm', apply: () => { Settings.setSubSize('m'); styleSubtitle(); openStyleMenu(); } },
      { label: t('size_large'), active: sz === 'l', apply: () => { Settings.setSubSize('l'); styleSubtitle(); openStyleMenu(); } },
      { label: `${t('sub_bg')}: ${Settings.subBg() ? t('opt_on') : t('option_off')}`, apply: () => { Settings.setSubBg(!Settings.subBg()); styleSubtitle(); openStyleMenu(); } },
    ]);
  }
  function flash(text: string): void { status.textContent = text; status.style.display = 'block'; window.setTimeout(() => { status.style.display = 'none'; }, 1800); }

  // ---- transport actions ----
  function toggle(): void { if (paused) { player.resume(); paused = false; } else { player.pause(); paused = true; } setPlayGlyph(); showControls(); }
  function seekRelative(delta: number): void { if (durMs <= 0) return; const tgt = Math.max(0, Math.min(durMs, curMs + delta)); player.seekTo(tgt); curMs = tgt; updateProgress(); showControls(); }
  function holdSeek(dir: number): void {
    if (!tracks || durMs <= 0) return;
    if (!seeking) { seeking = true; seekTarget = curMs; seekPresses = 0; }
    seekPresses++;
    const step = seekPresses < 5 ? 10 : seekPresses < 10 ? 30 : seekPresses < 20 ? 60 : 120;
    seekTarget = Math.max(0, Math.min(durMs, seekTarget + dir * step * 1000));
    seekHud.textContent = `${dir > 0 ? '⏩' : '⏪'}  ${fmt(seekTarget)} / ${fmt(durMs)}`;
    seekHud.classList.add('show');
    barFill.style.width = Math.min(100, (seekTarget / durMs) * 100) + '%';
    controls.classList.add('show');
    clearTimeout(seekTimer); seekTimer = window.setTimeout(commitSeek, 450);
  }
  function commitSeek(): void { if (!seeking) return; player.seekTo(seekTarget); curMs = seekTarget; seeking = false; seekPresses = 0; seekHud.classList.remove('show'); resetHide(); }

  function playCurrent(directUrl?: string): void {
    if (!profile) { flash('Profil bulunamadı'); return; }
    prefsApplied = false; resumed = false; paused = false; setPlayGlyph();
    const url = buildStreamUrl({ serverUrl: profile.serverUrl, username: profile.username, password: profile.password, streamId, type: p.type, extension: p.extension, directUrl: directUrl ?? p.directUrl });
    document.body.classList.add('playing');
    player.play({ url });
  }
  function switchTo(i: number): void {
    if (channels.length === 0) return;
    index = ((i % channels.length) + channels.length) % channels.length;
    const ch = channels[index];
    streamId = ch.streamId; name = ch.name || ''; epgEl.textContent = ''; renderFav();
    playCurrent(ch.directUrl); void loadEpg(streamId); showControls();
  }
  async function loadEpg(sid: number): Promise<void> {
    try { const r = await getClient().getShortEpg(sid); const now = r.epg_listings?.[0]; epgEl.textContent = now ? b64(now.title) : (name || ''); }
    catch { epgEl.textContent = name || ''; }
  }

  return {
    el: root,
    onMount() {
      if (tracks) save(resumeMs, 0, false);
      styleSubtitle();
      if (isLive) epgEl.textContent = name;
      playCurrent(p.directUrl);
      if (isLive) void loadEpg(streamId);
      showControls();
    },
    onKey(e) {
      const ae = document.activeElement as HTMLElement | null;
      dbg.textContent = 'key ' + e.keyCode + ' · focus: ' + ((ae?.textContent || ae?.className || ae?.tagName || 'body').trim().slice(0, 20)) + ' · ' + (controlsVisible() ? 'ctrl' : menuOpen ? 'menu' : 'idle');
      if (menuOpen) {
        switch (e.keyCode) {
          case KEY.UP: moveZone(-1); return true;
          case KEY.DOWN: moveZone(1); return true;
          case KEY.ENTER: zone[zoneIdx]?.click(); return true;
          case KEY.BACK: case KEY.EXIT: closeMenu(); return true;
          default: return true;
        }
      }
      if (controlsVisible()) {
        resetHide();
        const ae = document.activeElement as HTMLElement | null;

        // İlerleme çubuğu odaktayken sağ/sol tuşları doğrudan sarmayı tetikler
        if (ae === progress && tracks) {
          if (e.keyCode === KEY.LEFT) { seekRelative(-10000); return true; }
          if (e.keyCode === KEY.RIGHT) { seekRelative(10000); return true; }
        }

        switch (e.keyCode) {
          case KEY.LEFT: moveFocus('left'); return true;
          case KEY.RIGHT: moveFocus('right'); return true;
          case KEY.UP: moveFocus('up'); return true;
          case KEY.DOWN: moveFocus('down'); return true;
          case KEY.ENTER:
            if (ae === progress) {
              toggle(); // İlerleme çubuğunda Enter'a basılırsa videoyu duraklat/oynat
            } else {
              ae?.click();
            }
            return true;
          case KEY.PLAYPAUSE: toggle(); return true;
          case KEY.PLAY: player.resume(); paused = false; setPlayGlyph(); return true;
          case KEY.PAUSE: player.pause(); paused = true; setPlayGlyph(); return true;
          case KEY.BACK: case KEY.EXIT: exitPlayer(); return true;
          default: return true;
        }
      }
      switch (e.keyCode) {
        case KEY.BACK: case KEY.EXIT: exitPlayer(); return true;
        case KEY.PLAYPAUSE: toggle(); return true;
        case KEY.PLAY: player.resume(); paused = false; setPlayGlyph(); showControls(); return true;
        case KEY.PAUSE: player.pause(); paused = true; setPlayGlyph(); showControls(); return true;
        case KEY.LEFT: if (tracks) holdSeek(-1); else showControls(); return true;
        case KEY.RIGHT: if (tracks) holdSeek(1); else showControls(); return true;
        case KEY.REWIND: if (tracks) holdSeek(-1); return true;
        case KEY.FASTFORWARD: if (tracks) holdSeek(1); return true;
        case KEY.UP: if (isLive) switchTo(index - 1); else showControls(); return true;
        case KEY.DOWN: if (isLive) switchTo(index + 1); else showControls(); return true;
        default: showControls(); return true;
      }
    },
    onDestroy() { player.stop(); document.body.classList.remove('playing'); clearTimeout(hideTimer); clearInterval(hudTimer); clearTimeout(seekTimer); },
  };
}

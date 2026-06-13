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
interface EpisodeLite { streamId: number; name?: string; extension?: string; directUrl?: string; image?: string; }
interface PlayerParams {
  streamId: number; type: StreamType; extension?: string; name?: string; directUrl?: string;
  image?: string; categoryId?: string; channels?: ChannelLite[]; index?: number;
  episodes?: EpisodeLite[]; // dizilerde "sıradaki bölüm" için sezon bölüm listesi
}

const A3TO2: Record<string, string> = { tur: 'tr', eng: 'en', ger: 'de', deu: 'de', fra: 'fr', fre: 'fr', rus: 'ru', ara: 'ar', spa: 'es', ita: 'it', por: 'pt', dut: 'nl', pol: 'pl' };
const norm = (l?: string): string => { const x = (l || '').toLowerCase(); return A3TO2[x] || x.slice(0, 2); };
const b64 = (s: string): string => { try { return decodeURIComponent(escape(window.atob(s))); } catch { try { return window.atob(s); } catch { return s; } } };
const fmt = (ms: number): string => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0'); };

export function playerScreen(params: Record<string, unknown> = {}): Screen {
  const p = params as unknown as PlayerParams;
  const profile = getActiveProfile();
  const isLive = p.type === 'live';
  const isSeries = p.type === 'series';
  const tracks = p.type === 'movie' || p.type === 'series';
  const favType: StreamKind = p.type === 'movie' ? 'vod' : p.type;

  let streamId = p.streamId;
  let name = p.name || '';
  let extension = p.extension;
  const channels = p.channels ?? [];
  const episodes = p.episodes ?? [];
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
    : [tbtn('⏮', 'tbtn-side', () => nudgeSeek(-300000)), tbtn('⏪', 'tbtn-seek', () => holdSeek(-1)), playBtn, tbtn('⏩', 'tbtn-seek', () => holdSeek(1)), tbtn('⏭', 'tbtn-side', () => nudgeSeek(300000))];

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

  // ---- Sıradaki Bölüm kartı (Netflix tarzı, bölüm sonuna yaklaşınca belirir) ----
  const nextEpName = el('div', { class: 'next-ep-name' });
  const nextEpBtn = el('button', { class: 'btn primary next-ep-btn', focusable: true, text: t('next_episode_play'), onClick: () => playNextEpisode() });
  const nextEpCard = el('div', { class: 'next-ep-card' }, [
    el('div', { class: 'next-ep-label', text: t('next_episode') }),
    nextEpName,
    nextEpBtn,
  ]);

  const root = el('div', { class: 'screen player-screen' }, [subtitle, seekHud, status, controls, menu, nextEpCard]);

  // ---- state ----
  let paused = false, resumeMs = 0, resumed = false, lastSaved = 0;
  let curMs = 0, durMs = 0;
  let hideTimer = 0, hudTimer = 0;
  let menuOpen = false, prefsApplied = false;
  let seeking = false, seekTarget = 0, seekTimer = 0;
  let gestureStart = 0, lastTick = 0;     // basılı-tutma sarma jesti zamanlaması
  let settleTarget = -1, settleUntil = 0; // seek sonrası eski konum raporlarını yutma penceresi
  let nextEpVisible = false, nextEpDismissed = false; // sıradaki bölüm kartı durumu
  let zone: HTMLElement[] = [], zoneIdx = 0;

  if (tracks) { const prev = History.get(streamId, p.type); if (prev && !prev.isFinished && prev.lastPosition > 30000) resumeMs = prev.lastPosition; }
  const save = (cur: number, dur: number, fin: boolean): void => History.record({ streamId, streamType: p.type, categoryId: p.categoryId, name, image: p.image, lastPosition: cur, maxDuration: dur, isFinished: fin });

  const player = new AVPlayer(
    document.getElementById('av-player'),
    document.getElementById('av-fallback') as HTMLVideoElement | null,
    {
      onState: (s) => {
        setStatus(s);
        if (s === 'playing') { paused = false; setPlayGlyph(); onPlaying(); }
        if (s === 'paused') { paused = true; setPlayGlyph(); }
        // Bölüm gerçekten bittiğinde (kullanıcı kartı kapatmadıysa) sıradakine geç.
        if (s === 'ended' && isSeries && hasNextEpisode() && !nextEpDismissed) playNextEpisode();
      },
      onTime: (cur, dur) => {
        durMs = dur;
        // AVPlay seek sonrası bir süre daha ESKİ konumu raporlar; hedefe oturana
        // kadar bu raporları yok say ki bar geriye sıçramasın ve ardışık
        // sarmalar bayat konumdan başlamasın.
        if (settleTarget >= 0) {
          if (Math.abs(cur - settleTarget) > 4000 && Date.now() < settleUntil) return;
          settleTarget = -1;
        }
        curMs = cur;
        if (!seeking) updateProgress();
        if (tracks && cur > 0) { const fin = dur > 0 && cur / dur > 0.95; const now = Date.now(); if (fin || now - lastSaved > 5000) { lastSaved = now; save(cur, dur, fin); } }
        // Son NEAR_END_MS içine girince "Sıradaki Bölüm" kartını göster; geri sarılırsa gizle.
        if (isSeries && hasNextEpisode() && durMs > 60000) {
          const remaining = durMs - curMs;
          if (remaining > 0 && remaining <= NEXT_EP_NEAR_END_MS) showNextEp();
          else if (nextEpVisible && remaining > NEXT_EP_NEAR_END_MS + 5000) hideNextEp();
        }
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

  // ---- Netflix tarzı hızlanan sarma ----
  // Basılı tutarken yalnızca HEDEF konum, bar ve HUD ilerler; gerçek seek,
  // tuş bırakıldıktan SEEK_COMMIT_MS sonra TEK SEFER yapılır. AVPlay'de her
  // seek pahalıdır — tekrar başına seek göndermek yavaşlığın asıl nedeniydi.
  // Adım, tutma süresiyle büyür: 0-1.5sn→10sn · 1.5-4sn→30sn · 4-8sn→60sn · 8sn+→120sn.
  // Tik aralığı sabit (SEEK_TICK_MS) — kumandanın tekrar hızından bağımsız,
  // her TV modelinde aynı tarama hızını verir (~2 saatlik film ≈ 15-18 sn'de baştan sona).
  const SEEK_TICK_MS = 180;
  const SEEK_COMMIT_MS = 450;
  function holdStep(heldMs: number): number { return heldMs < 1500 ? 10000 : heldMs < 4000 ? 30000 : heldMs < 8000 ? 60000 : 120000; }
  function holdSeek(dir: number): void {
    if (!tracks || durMs <= 0) return;
    const now = Date.now();
    if (!seeking) { gestureStart = now; lastTick = 0; }
    else if (now - lastTick < SEEK_TICK_MS) { armCommit(); return; } // fazla tuş tekrarlarını yut
    lastTick = now;
    nudgeSeek(dir * holdStep(now - gestureStart));
  }
  function nudgeSeek(deltaMs: number): void {
    if (!tracks || durMs <= 0) return;
    if (!seeking) { seeking = true; seekTarget = curMs; if (!gestureStart) gestureStart = Date.now(); }
    seekTarget = Math.max(0, Math.min(durMs - 1000, seekTarget + deltaMs));
    const d = seekTarget - curMs;
    seekHud.textContent = `${deltaMs >= 0 ? '⏩' : '⏪'}  ${d < 0 ? '−' : '+'}${fmt(Math.abs(d))}  ·  ${fmt(seekTarget)}`;
    seekHud.classList.add('show');
    barFill.style.width = Math.min(100, (seekTarget / durMs) * 100) + '%';
    curT.textContent = fmt(seekTarget);
    controls.classList.add('show');
    armCommit();
  }
  function armCommit(): void { clearTimeout(seekTimer); seekTimer = window.setTimeout(commitSeek, SEEK_COMMIT_MS); }
  function commitSeek(): void {
    if (!seeking) return;
    seeking = false; gestureStart = 0;
    settleTarget = seekTarget; settleUntil = Date.now() + 2500;
    player.seekTo(seekTarget);
    curMs = seekTarget;
    seekHud.classList.remove('show');
    updateProgress(); resetHide();
  }

  function playCurrent(directUrl?: string): void {
    if (!profile) { flash('Profil bulunamadı'); return; }
    prefsApplied = false; resumed = false; paused = false; setPlayGlyph();
    const url = buildStreamUrl({ serverUrl: profile.serverUrl, username: profile.username, password: profile.password, streamId, type: p.type, extension, directUrl: directUrl ?? p.directUrl });
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

  // ---- Sıradaki Bölüm ----
  const NEXT_EP_NEAR_END_MS = 40000; // bölümün son 40 saniyesinde kart belirir
  function hasNextEpisode(): boolean { return isSeries && index + 1 < episodes.length; }
  function showNextEp(): void {
    if (nextEpVisible || nextEpDismissed || menuOpen || seeking || !hasNextEpisode()) return;
    nextEpVisible = true;
    const next = episodes[index + 1];
    nextEpName.textContent = next.name || t('text_episode');
    nextEpCard.classList.add('show');
    // Kullanıcı pasif izliyorsa (kontroller gizli) odağı butona al ki OK doğrudan geçsin.
    if (!controlsVisible()) requestAnimationFrame(() => nextEpBtn.focus());
  }
  function hideNextEp(): void { nextEpVisible = false; nextEpCard.classList.remove('show'); }
  function dismissNextEp(): void { nextEpDismissed = true; hideNextEp(); }
  function playNextEpisode(): void {
    if (!hasNextEpisode()) return;
    hideNextEp(); nextEpDismissed = false;
    index += 1;
    const ep = episodes[index];
    streamId = ep.streamId; name = ep.name || ''; extension = ep.extension || extension;
    resumeMs = 0; resumed = false; curMs = 0; durMs = 0; lastSaved = 0;
    renderFav();
    playCurrent(ep.directUrl);
    showControls();
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
      if (menuOpen) {
        switch (e.keyCode) {
          case KEY.UP: moveZone(-1); return true;
          case KEY.DOWN: moveZone(1); return true;
          case KEY.ENTER: zone[zoneIdx]?.click(); return true;
          case KEY.BACK: case KEY.EXIT: closeMenu(); return true;
          default: return true;
        }
      }
      // Sıradaki Bölüm kartı görünür ve kontroller gizliyken (pasif izleme): OK ile
      // hemen geç, Geri ile kartı kapat. Diğer tuşlar normal akışa düşer (sarma/kontrol).
      if (nextEpVisible && !controlsVisible()) {
        if (e.keyCode === KEY.ENTER) { playNextEpisode(); return true; }
        if (e.keyCode === KEY.BACK || e.keyCode === KEY.EXIT) { dismissNextEp(); return true; }
      }
      // Aktif sarma jesti varsa kontroller görünür olsa bile tekrar tuşları jesti
      // sürdürür — yoksa kumandanın otomatik tekrarları odak gezdirmeye dönüşüp
      // basılı tutmayı ilk +10sn'de keserdi (eski "çok yavaş ilerleme" hatası).
      if (tracks && seeking) {
        if (e.keyCode === KEY.LEFT || e.keyCode === KEY.REWIND) { holdSeek(-1); return true; }
        if (e.keyCode === KEY.RIGHT || e.keyCode === KEY.FASTFORWARD) { holdSeek(1); return true; }
        if (e.keyCode === KEY.ENTER) { clearTimeout(seekTimer); commitSeek(); return true; } // OK = hedefe hemen atla
      }
      if (controlsVisible()) {
        resetHide();
        const ae = document.activeElement as HTMLElement | null;

        // İlerleme çubuğu odaktayken sağ/sol, hızlanan sarmayı sürer
        if (ae === progress && tracks) {
          if (e.keyCode === KEY.LEFT) { holdSeek(-1); return true; }
          if (e.keyCode === KEY.RIGHT) { holdSeek(1); return true; }
        }

        switch (e.keyCode) {
          case KEY.LEFT: moveFocus('left'); return true;
          case KEY.RIGHT: moveFocus('right'); return true;
          case KEY.UP: moveFocus('up'); return true;
          case KEY.DOWN: moveFocus('down'); return true;
          case KEY.REWIND: if (tracks) holdSeek(-1); return true;
          case KEY.FASTFORWARD: if (tracks) holdSeek(1); return true;
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

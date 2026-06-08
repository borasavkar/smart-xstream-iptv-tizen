// AVPlay proof-of-concept, now a routed screen (reachable from home via 🔧).
// Preserves the player verification flow while the full app grows around it.
import { el } from '../ui/dom';
import { AVPlayer, type PlaybackState } from '../player/AVPlayer';
import { buildStreamUrl, normalizeServerUrl, type StreamType } from '../core/xtream';
import { KEY } from '../input/remote';
import type { Screen } from '../app/router';

const SAMPLE_HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

export function playerTestScreen(): Screen {
  const direct = el('input', { focusable: true, placeholder: 'Doğrudan stream URL (HLS / TS / MP4)' });
  const server = el('input', { focusable: true, placeholder: 'Sunucu: http://host:port' });
  const user = el('input', { focusable: true, placeholder: 'Kullanıcı adı' });
  const pass = el('input', { focusable: true, placeholder: 'Şifre' });
  const sid = el('input', { focusable: true, placeholder: 'Stream ID (örn. 12345)' });
  const type = el('select', { focusable: true }, [
    el('option', { value: 'live', text: 'Canlı (live)' }),
    el('option', { value: 'movie', text: 'Film (movie)' }),
    el('option', { value: 'series', text: 'Dizi (series)' }),
  ]);
  const ext = el('input', { focusable: true, placeholder: 'Uzantı: ts / m3u8 / mp4' });

  const statusEl = el('div', { class: 'status status-idle', text: 'Durum: idle' });
  const timeEl = el('div', { class: 'time', text: '0:00 / —' });
  const logEl = el('pre', { id: 'pt-log' });

  const btnDirect = el('button', { focusable: true, text: 'Örnek HLS doldur', onClick: () => { direct.value = SAMPLE_HLS; log('Örnek HLS dolduruldu.'); } });
  const btnPlay = el('button', { class: 'primary', focusable: true, text: '▶ Oynat', onClick: start });
  const btnStop = el('button', { focusable: true, text: '■ Durdur', onClick: () => { player.stop(); showPlayer(false); } });

  const root = el('div', { class: 'screen playertest' }, [
    el('header', { class: 'sub-top' }, [el('h1', { text: 'Oynatıcı Testi' }), statusEl]),
    el('div', { class: 'columns' }, [
      el('section', { class: 'panel' }, [
        el('h2', { text: '1) Hızlı test — bilinen HLS yayını' }),
        el('div', { class: 'row' }, [direct, btnDirect]),
        el('h2', { text: '2) Xtream hesabı' }),
        el('div', { class: 'grid' }, [server, user, pass, sid, type, ext]),
        el('div', { class: 'row actions' }, [btnPlay, btnStop]),
        el('p', { class: 'hint', text: 'Kumanda: Ok = gezin · Enter = seç · Return = durdur/çık' }),
      ]),
      el('aside', { class: 'panel log-panel' }, [
        el('h2', { text: 'Kayıt / Hata günlüğü' }), timeEl, logEl,
      ]),
    ]),
  ]);

  const player = new AVPlayer(
    document.getElementById('av-player'),
    document.getElementById('av-fallback') as HTMLVideoElement | null,
    {
      onState: (s, d) => { setStatus(s, d); if (s === 'idle' || s === 'error') showPlayer(false); },
      onTime: (c, dur) => { timeEl.textContent = fmt(c) + ' / ' + (dur ? fmt(dur) : 'CANLI'); },
      onLog: (l) => log(l),
    },
  );

  function log(line: string): void {
    const ts = new Date().toLocaleTimeString();
    logEl.textContent = (`[${ts}] ${line}\n` + logEl.textContent).slice(0, 6000);
  }
  function setStatus(s: PlaybackState, d?: string): void {
    statusEl.textContent = 'Durum: ' + s + (d ? ' — ' + d : '');
    statusEl.className = 'status status-' + s;
  }
  function showPlayer(on: boolean): void { document.body.classList.toggle('playing', on); }
  function isPlaying(): boolean { return document.body.classList.contains('playing'); }
  function fmt(ms: number): string { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  function start(): void {
    const d = direct.value.trim();
    const url = d ? d : buildStreamUrl({
      serverUrl: normalizeServerUrl(server.value),
      username: user.value.trim(),
      password: pass.value.trim(),
      streamId: sid.value.trim(),
      type: type.value as StreamType,
      extension: ext.value.trim() || undefined,
    });
    if (!url || url.endsWith('/.ts')) { log('URL eksik — doğrudan URL ya da Xtream alanlarını doldur.'); return; }
    log('Oynatılıyor: ' + url);
    showPlayer(true);
    player.play({ url });
  }

  return {
    el: root,
    onMount() { log('Backend: ' + player.backend); },
    onKey(e) {
      switch (e.keyCode) {
        case KEY.PLAY: player.resume(); return true;
        case KEY.PAUSE: player.pause(); return true;
        case KEY.PLAYPAUSE: isPlaying() ? player.pause() : start(); return true;
        case KEY.STOP: player.stop(); showPlayer(false); return true;
        case KEY.BACK:
        case KEY.EXIT:
          if (isPlaying()) { player.stop(); showPlayer(false); return true; } // stay on screen
          return false; // let router go back to home
        default: return false;
      }
    },
    onDestroy() { player.stop(); document.body.classList.remove('playing'); },
  };
}

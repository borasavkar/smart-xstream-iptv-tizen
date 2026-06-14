// Wrapper over Samsung AVPlay (webapis.avplay) with an HTML5 <video> fallback
// for browser development. Exposes track selection (audio/subtitle/video),
// live playback info (resolution + bandwidth), and subtitle text events so the
// player screen can render styled subtitles itself.

export type PlaybackState =
  | 'idle' | 'opening' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';

export interface PlayOptions {
  url: string;
  userAgent?: string;
  /** Tam ekran yerine belirli bir bölgede oynat (hızlı önizleme paneli için). */
  viewport?: { x: number; y: number; w: number; h: number };
}

export interface AVPlayerCallbacks {
  onState?: (state: PlaybackState, detail?: string) => void;
  onTime?: (currentMs: number, durationMs: number) => void;
  onSubtitle?: (text: string) => void;
  onLog?: (line: string) => void;
}

export type TrackType = 'AUDIO' | 'TEXT' | 'VIDEO';
export interface TrackOption {
  index: number;
  type: TrackType;
  label: string;
  lang?: string;   // ISO code (lowercased) when available
  height?: number; // for VIDEO tracks
}
export interface PlaybackInfo { width: number; height: number; bandwidthKbps: number; }

const DEFAULT_UA = 'VLC/3.0.18 LibVLC/3.0.18';

export class AVPlayer {
  private readonly obj: HTMLElement | null;
  private readonly video: HTMLVideoElement | null;
  private readonly cb: AVPlayerCallbacks;
  private readonly useAVPlay: boolean;

  constructor(objectEl: HTMLElement | null, videoEl: HTMLVideoElement | null, cb: AVPlayerCallbacks = {}) {
    this.obj = objectEl;
    this.video = videoEl;
    this.cb = cb;
    this.useAVPlay = typeof webapis !== 'undefined' && !!webapis && !!webapis.avplay;
    this.log(this.useAVPlay ? 'AVPlay backend hazır (Tizen TV).' : 'AVPlay yok → HTML5 <video> fallback.');
  }

  get backend(): 'avplay' | 'html5' { return this.useAVPlay ? 'avplay' : 'html5'; }

  private log(m: string): void { this.cb.onLog?.(m); }
  private setState(s: PlaybackState, d?: string): void { this.cb.onState?.(s, d); }

  play(opts: PlayOptions): void {
    if (this.useAVPlay) this.playAVPlay(opts);
    else this.playHtml5(opts);
  }

  private playAVPlay(opts: PlayOptions): void {
    const av = webapis.avplay;
    try {
      this.stopSilently();
      this.setState('opening', opts.url);
      av.open(opts.url);
      const vp = opts.viewport;
      av.setDisplayRect(vp?.x ?? 0, vp?.y ?? 0, vp?.w ?? 1920, vp?.h ?? 1080);
      if (this.obj) this.obj.style.display = 'block';
      // Önizleme penceresi: videoyu boşluk bırakmadan tüm dikdörtgene yay (oranı
      // koruyarak kırp = "cover"). CROPPED_FULL bazı eski firmware'lerde yok →
      // FULL_SCREEN'e, o da yoksa LETTER_BOX'a düş. Tam ekranda her zaman FULL_SCREEN.
      if (vp) {
        try { av.setDisplayMethod('PLAYER_DISPLAY_MODE_CROPPED_FULL'); }
        catch { try { av.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN'); } catch { /* */ } }
      } else {
        try { av.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN'); } catch { /* older firmware */ }
      }
      try { av.setStreamingProperty('USER_AGENT', opts.userAgent || DEFAULT_UA); } catch (e) { this.log('UA: ' + msg(e)); }

      av.setListener({
        onbufferingstart: () => this.setState('buffering'),
        onbufferingcomplete: () => this.setState('playing'),
        onstreamcompleted: () => { this.setState('ended'); this.stopSilently(); },
        oncurrentplaytime: (t) => this.cb.onTime?.(t, safeDuration(av)),
        onevent: (type, data) => this.log('event: ' + type + (data ? ' · ' + data : '')),
        onerror: (type) => { this.setState('error', type); this.log('AVPlay HATA: ' + type); },
        onsubtitlechange: (_d, text) => this.cb.onSubtitle?.(text),
        ondrmevent: () => { /* DRM later */ },
      });

      av.prepareAsync(
        () => { av.play(); this.setState('playing'); },
        (e) => { this.setState('error', 'prepare: ' + msg(e)); },
      );
    } catch (e) {
      this.setState('error', msg(e));
    }
  }

  private playHtml5(opts: PlayOptions): void {
    const v = this.video;
    if (!v) { this.setState('error', '<video> yok'); return; }
    this.setState('opening', opts.url);
    const vp = opts.viewport;
    // Önizleme: videoyu panel bölgesine konumlandır ve katmanın deliğinden
    // görünecek şekilde öne al; tam ekran oynatmada stiller sıfırlanır.
    v.style.top = vp ? vp.y + 'px' : '';
    v.style.left = vp ? vp.x + 'px' : '';
    v.style.width = vp ? vp.w + 'px' : '';
    v.style.height = vp ? vp.h + 'px' : '';
    v.style.zIndex = vp ? '39' : '';
    // Önizlemede video kartın tamamını kaplasın (boşluk bırakmadan kırparak doldur).
    v.style.objectFit = vp ? 'cover' : '';
    v.style.display = 'block';
    v.src = opts.url;
    v.onwaiting = () => this.setState('buffering');
    v.onplaying = () => this.setState('playing');
    v.onended = () => this.setState('ended');
    v.onerror = () => this.setState('error', 'video ' + (v.error?.code ?? ''));
    v.ontimeupdate = () => this.cb.onTime?.(v.currentTime * 1000, (isFinite(v.duration) ? v.duration : 0) * 1000);
    void v.play().catch((err) => this.setState('error', msg(err)));
  }

  pause(): void {
    if (this.useAVPlay) { try { webapis.avplay.pause(); this.setState('paused'); } catch { /* */ } }
    else { this.video?.pause(); this.setState('paused'); }
  }
  resume(): void {
    if (this.useAVPlay) { try { webapis.avplay.play(); this.setState('playing'); } catch { /* */ } }
    else { void this.video?.play(); this.setState('playing'); }
  }
  seekTo(ms: number): void {
    try {
      if (this.useAVPlay) webapis.avplay.seekTo(Math.max(0, Math.floor(ms)));
      else if (this.video) this.video.currentTime = Math.max(0, ms / 1000);
    } catch { /* */ }
  }

  getTracks(type: TrackType): TrackOption[] {
    if (this.useAVPlay) {
      try {
        return webapis.avplay.getTotalTrackInfo()
          .filter((tr) => tr.type === type)
          .map((tr) => ({ index: tr.index, type, ...avTrackMeta(type, tr.extra_info, tr.index) }));
      } catch { return []; }
    }
    if (this.video && type === 'TEXT') {
      const out: TrackOption[] = [];
      const tt = this.video.textTracks;
      for (let i = 0; i < tt.length; i++) out.push({ index: i, type, label: tt[i].label || tt[i].language || String(i + 1), lang: (tt[i].language || '').toLowerCase() });
      return out;
    }
    return [];
  }

  selectTrack(type: TrackType, index: number): void {
    try {
      if (this.useAVPlay) { webapis.avplay.setSelectTrack(type, index); return; }
      if (this.video && type === 'TEXT') {
        const tt = this.video.textTracks;
        for (let i = 0; i < tt.length; i++) tt[i].mode = i === index ? 'showing' : 'disabled';
      }
    } catch { /* */ }
  }

  disableSubtitles(): void {
    try {
      if (this.useAVPlay) { webapis.avplay.setSilentSubtitle?.(true); return; }
      if (this.video) { const tt = this.video.textTracks; for (let i = 0; i < tt.length; i++) tt[i].mode = 'disabled'; }
    } catch { /* */ }
  }

  /** Current resolution + bandwidth, for the on-screen HUD. */
  getPlaybackInfo(): PlaybackInfo {
    let width = 0, height = 0, bandwidthKbps = 0;
    if (this.useAVPlay) {
      try {
        for (const s of webapis.avplay.getCurrentStreamInfo()) {
          if (s.type === 'VIDEO') {
            const e = parseTrackInfo(s.extra_info);
            width = Number(e?.['Width'] ?? e?.['width'] ?? 0);
            height = Number(e?.['Height'] ?? e?.['height'] ?? 0);
          }
        }
      } catch { /* */ }
      try { bandwidthKbps = Math.round(Number(webapis.avplay.getStreamingProperty('CURRENT_BANDWIDTH')) / 1000); } catch { /* */ }
    } else if (this.video) {
      width = this.video.videoWidth; height = this.video.videoHeight;
    }
    if (!Number.isFinite(bandwidthKbps) || bandwidthKbps < 0) bandwidthKbps = 0;
    return { width, height, bandwidthKbps };
  }

  stop(): void { this.stopSilently(); this.setState('idle'); }

  private stopSilently(): void {
    try {
      if (this.useAVPlay) {
        const st = webapis.avplay.getState();
        if (st !== 'NONE' && st !== 'IDLE') { webapis.avplay.stop(); webapis.avplay.close(); }
      } else if (this.video) {
        this.video.pause(); this.video.removeAttribute('src'); this.video.load(); this.video.style.display = 'none';
      }
      if (this.obj) this.obj.style.display = 'none';
    } catch { /* */ }
  }
}

function safeDuration(av: AVPlay): number { try { return av.getDuration(); } catch { return 0; } }
function msg(e: unknown): string { return e instanceof Error ? e.message : String(e); }
function parseTrackInfo(s: string): Record<string, unknown> | null { try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; } }

const LANG_NAMES: Record<string, string> = {
  tr: 'Türkçe', tur: 'Türkçe', en: 'İngilizce', eng: 'İngilizce', de: 'Almanca', ger: 'Almanca', deu: 'Almanca',
  fr: 'Fransızca', fra: 'Fransızca', fre: 'Fransızca', ru: 'Rusça', rus: 'Rusça', ar: 'Arapça', ara: 'Arapça',
  es: 'İspanyolca', spa: 'İspanyolca', it: 'İtalyanca', ita: 'İtalyanca', pt: 'Portekizce', por: 'Portekizce',
  nl: 'Felemenkçe', dut: 'Felemenkçe', nld: 'Felemenkçe', pl: 'Lehçe', pol: 'Lehçe',
  zh: 'Çince', chi: 'Çince', zho: 'Çince', ja: 'Japonca', jpn: 'Japonca', ko: 'Korece', kor: 'Korece',
  hi: 'Hintçe', hin: 'Hintçe', fa: 'Farsça', per: 'Farsça', fas: 'Farsça', ur: 'Urduca', urd: 'Urduca',
  el: 'Yunanca', gre: 'Yunanca', ell: 'Yunanca', sv: 'İsveççe', swe: 'İsveççe', no: 'Norveççe', nor: 'Norveççe',
  nb: 'Norveççe', da: 'Danca', dan: 'Danca', fi: 'Fince', fin: 'Fince', cs: 'Çekçe', cze: 'Çekçe', ces: 'Çekçe',
  hu: 'Macarca', hun: 'Macarca', ro: 'Rumence', rum: 'Rumence', ron: 'Rumence', bg: 'Bulgarca', bul: 'Bulgarca',
  sr: 'Sırpça', srp: 'Sırpça', hr: 'Hırvatça', hrv: 'Hırvatça', uk: 'Ukraynaca', ukr: 'Ukraynaca',
  he: 'İbranice', heb: 'İbranice', th: 'Tayca', tha: 'Tayca', vi: 'Vietnamca', vie: 'Vietnamca',
  id: 'Endonezce', ind: 'Endonezce', az: 'Azerice', aze: 'Azerice', ka: 'Gürcüce', kat: 'Gürcüce',
};
function langName(code: string): string {
  const c = code.toLowerCase();
  if (LANG_NAMES[c]) return LANG_NAMES[c];
  // Zaten tam ad gelmiş olabilir (ör. "English") → ilk harf büyük döndür.
  if (c.length > 3) return code.charAt(0).toUpperCase() + code.slice(1);
  return code.toUpperCase();
}

// AVPlay'in AUDIO/TEXT iz extra_info'sundan dili çıkar. Firmware'e göre anahtar
// adı değişir (language, lang, track_lang, langCode, language_code, ISO_639…);
// JSON değilse düz kodun kendisi dönebilir. Adında "lang" geçen tüm anahtarları
// ve bilinen anahtarları tarayıp ilk geçerli değeri al.
function trackLang(info: Record<string, unknown> | null, extra: string): string | undefined {
  const cands: string[] = [];
  if (info) {
    for (const k of Object.keys(info)) if (/lang/i.test(k)) cands.push(String(info[k] ?? ''));
    for (const k of ['language', 'lang', 'track_lang', 'langCode', 'language_code', 'lang_code', 'ISO_639', 'iso_639', 'audioLang', 'subtitleLang']) {
      if (info[k] != null) cands.push(String(info[k]));
    }
  } else if (extra) {
    cands.push(extra); // JSON değil → düz dil kodu olabilir
  }
  for (const c of cands) {
    const v = c.trim().toLowerCase();
    if (v && v !== 'und' && v !== 'unknown' && v !== 'unk' && v !== 'null' && v !== 'none') return v;
  }
  return undefined;
}

function avTrackMeta(type: TrackType, extra: string, index: number): { label: string; lang?: string; height?: number } {
  const info = parseTrackInfo(extra);
  if (type === 'VIDEO') {
    const w = Number(info?.['Width'] ?? info?.['width'] ?? 0);
    const h = Number(info?.['Height'] ?? info?.['height'] ?? 0);
    return { label: w && h ? `${w}x${h}` : String(index + 1), height: h || undefined };
  }
  const lang = trackLang(info, extra);
  // Dil bulunamazsa numara yerine "Altyazı N" / "Ses N" daha anlaşılır.
  const fallback = (type === 'TEXT' ? 'Altyazı ' : 'Ses ') + (index + 1);
  return { label: lang ? langName(lang) : fallback, lang };
}

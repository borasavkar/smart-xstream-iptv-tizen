// Ambient type declarations for the Samsung Tizen TV Web Device API (webapis)
// and the core Tizen API. These globals exist only on real TV hardware; in a
// desktop browser they are undefined, so guard with `typeof webapis !== 'undefined'`.
// NOTE: no top-level import/export here on purpose — keeps declarations global.

interface AVPlayListener {
  onbufferingstart?: () => void;
  onbufferingprogress?: (percent: number) => void;
  onbufferingcomplete?: () => void;
  onstreamcompleted?: () => void;
  oncurrentplaytime?: (currentTime: number) => void;
  onevent?: (eventType: string, eventData: string | null) => void;
  onerror?: (eventType: string) => void;
  onsubtitlechange?: (duration: number, text: string, data3: number, data4: unknown) => void;
  ondrmevent?: (drmEvent: string, drmData: unknown) => void;
}

interface AVPlayTrackInfo {
  index: number;
  type: string; // 'VIDEO' | 'AUDIO' | 'TEXT'
  extra_info: string; // JSON string with language/codec/etc.
}

interface AVPlay {
  open(url: string): void;
  close(): void;
  prepare(): void;
  prepareAsync(onsuccess: () => void, onerror: (e: unknown) => void): void;
  setListener(listener: AVPlayListener): void;
  setDisplayRect(x: number, y: number, width: number, height: number): void;
  setDisplayMethod(method: string): void;
  play(): void;
  pause(): void;
  stop(): void;
  seekTo(milliseconds: number): void;
  jumpForward(milliseconds: number): void;
  jumpBackward(milliseconds: number): void;
  getState(): string; // 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED'
  getDuration(): number;
  getCurrentTime(): number;
  setStreamingProperty(type: string, value: string): void;
  getStreamingProperty(type: string): string;
  getCurrentStreamInfo(): AVPlayTrackInfo[];
  getTotalTrackInfo(): AVPlayTrackInfo[];
  setSelectTrack(type: string, index: number): void;
  setSilentSubtitle?(silent: boolean): void;
  setSpeed(speed: number): void;
}

interface TizenProductInfo {
  getDuid(): string;
  getModelCode?(): string;
  getFirmware?(): string;
}

interface WebAPIs {
  avplay: AVPlay;
  productinfo?: TizenProductInfo;
}

declare const webapis: WebAPIs;

// --- Core Tizen API (subset we use) ---
interface TizenInputDevice {
  registerKey(keyName: string): void;
  unregisterKey(keyName: string): void;
  getSupportedKeys(): Array<{ name: string; code: number }>;
}
interface TizenApplication {
  exit(): void;
  hide(): void;
}
interface TizenApplicationManager {
  getCurrentApplication(): TizenApplication;
}
interface Tizen {
  tvinputdevice: TizenInputDevice;
  application: TizenApplicationManager;
}

declare const tizen: Tizen;

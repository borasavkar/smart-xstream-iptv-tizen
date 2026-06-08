// App settings, ported from utils/SettingsManager.kt (SharedPreferences).
// Backed by localStorage.

interface SettingsShape {
  selectedProfileId: number;
  demoMode: boolean;
  premium: boolean;
  audioLang: string;
  subtitleLang: string;
  uiLang: string;
  subtitleEnabled: boolean;
  subSize: string;   // 's' | 'm' | 'l'
  subColor: string;  // hex
  subBg: boolean;
  videoQuality: string; // 'auto' | '2160' | '1080' | '720' | '480'
  introSeen: boolean;
}

const KEY = 'sx_settings';

function systemLang(): string {
  return (navigator.language || 'tr').slice(0, 2);
}

function defaults(): SettingsShape {
  return {
    selectedProfileId: -1,
    demoMode: true,
    premium: false,
    audioLang: systemLang(),
    subtitleLang: systemLang(),
    uiLang: systemLang(),
    subtitleEnabled: true,
    subSize: 'm',
    subColor: '#FFFFFF',
    subBg: true,
    videoQuality: 'auto',
    introSeen: false,
  };
}

function read(): SettingsShape {
  try { return { ...defaults(), ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<SettingsShape>) }; }
  catch { return defaults(); }
}

function patch(p: Partial<SettingsShape>): void {
  localStorage.setItem(KEY, JSON.stringify({ ...read(), ...p }));
}

export const Settings = {
  selectedProfileId: (): number => read().selectedProfileId,
  setSelectedProfileId: (id: number): void => patch({ selectedProfileId: id }),

  demoMode: (): boolean => read().demoMode,
  setDemoMode: (v: boolean): void => patch({ demoMode: v }),

  premium: (): boolean => read().premium,
  setPremium: (v: boolean): void => patch({ premium: v }),

  introSeen: (): boolean => read().introSeen,
  setIntroSeen: (v: boolean): void => patch({ introSeen: v }),

  audioLang: (): string => read().audioLang,
  setAudioLang: (v: string): void => patch({ audioLang: v }),

  subtitleLang: (): string => read().subtitleLang,
  setSubtitleLang: (v: string): void => patch({ subtitleLang: v }),

  uiLang: (): string => read().uiLang,
  setUiLang: (v: string): void => patch({ uiLang: v }),

  subtitleEnabled: (): boolean => read().subtitleEnabled,
  setSubtitleEnabled: (v: boolean): void => patch({ subtitleEnabled: v }),
  subSize: (): string => read().subSize,
  setSubSize: (v: string): void => patch({ subSize: v }),
  subColor: (): string => read().subColor,
  setSubColor: (v: string): void => patch({ subColor: v }),
  subBg: (): boolean => read().subBg,
  setSubBg: (v: boolean): void => patch({ subBg: v }),
  videoQuality: (): string => read().videoQuality,
  setVideoQuality: (v: string): void => patch({ videoQuality: v }),
};

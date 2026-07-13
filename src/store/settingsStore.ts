import { create } from 'zustand';
import { gameConfig, type GraphicsQuality } from '../config/game.config';

export const SETTINGS_STORAGE_KEY = 'el-salvador-rutas-perdidas:settings';
export const SETTINGS_VERSION = 1;

export interface VisualSettings {
  graphicsQuality: GraphicsQuality;
  reduceMotion: boolean;
  ambientFog: boolean;
  tutorialSeen: boolean;
}

interface SettingsStore extends VisualSettings {
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  setReduceMotion: (enabled: boolean) => void;
  setAmbientFog: (enabled: boolean) => void;
  setTutorialSeen: (seen: boolean) => void;
}

interface SettingsEnvelope {
  version: typeof SETTINGS_VERSION;
  settings: VisualSettings;
}

const defaultSettings: VisualSettings = {
  graphicsQuality: gameConfig.defaultGraphicsQuality,
  reduceMotion: false,
  ambientFog: true,
  tutorialSeen: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return value === 'low' || value === 'medium' || value === 'high';
}

export function parseVisualSettings(raw: string): VisualSettings | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.version !== SETTINGS_VERSION) return null;
  const value = parsed.settings;
  if (!isRecord(value)) return null;

  return {
    graphicsQuality: isGraphicsQuality(value.graphicsQuality)
      ? value.graphicsQuality
      : defaultSettings.graphicsQuality,
    reduceMotion: value.reduceMotion === true,
    ambientFog: value.ambientFog !== false,
    tutorialSeen: value.tutorialSeen === true,
  };
}

function loadVisualSettings(): VisualSettings {
  try {
    if (typeof window === 'undefined') return defaultSettings;
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw
      ? (parseVisualSettings(raw) ?? defaultSettings)
      : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function saveVisualSettings(settings: VisualSettings): void {
  const envelope: SettingsEnvelope = {
    version: SETTINGS_VERSION,
    settings,
  };
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(envelope),
      );
    }
  } catch {
    // El juego continúa aunque el navegador bloquee localStorage.
  }
}

function visualSettings(state: VisualSettings): VisualSettings {
  return {
    graphicsQuality: state.graphicsQuality,
    reduceMotion: state.reduceMotion,
    ambientFog: state.ambientFog,
    tutorialSeen: state.tutorialSeen,
  };
}

const initialSettings = loadVisualSettings();

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...initialSettings,
  setGraphicsQuality: (graphicsQuality) =>
    set((state) => {
      const next = { ...visualSettings(state), graphicsQuality };
      saveVisualSettings(next);
      return next;
    }),
  setReduceMotion: (reduceMotion) =>
    set((state) => {
      const next = { ...visualSettings(state), reduceMotion };
      saveVisualSettings(next);
      return next;
    }),
  setAmbientFog: (ambientFog) =>
    set((state) => {
      const next = { ...visualSettings(state), ambientFog };
      saveVisualSettings(next);
      return next;
    }),
  setTutorialSeen: (tutorialSeen) =>
    set((state) => {
      const next = { ...visualSettings(state), tutorialSeen };
      saveVisualSettings(next);
      return next;
    }),
}));

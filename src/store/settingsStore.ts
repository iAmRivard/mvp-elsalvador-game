import { create } from 'zustand';
import { gameConfig, type GraphicsQuality } from '../config/game.config';
import {
  defaultMobileControlsSettings,
  type JoystickPositionMode,
  type JoystickSize,
  type MobileControlMode,
  type MobileControlsSettings,
} from '../config/mobileControls.config';
import type { RoadAssistMode } from '../config/roadHandling.config';
import type { SteeringSensitivity } from '../config/travel.config';

export const SETTINGS_STORAGE_KEY = 'el-salvador-rutas-perdidas:settings';
export const SETTINGS_VERSION = 8;

export interface VisualSettings extends MobileControlsSettings {
  graphicsQuality: GraphicsQuality;
  reduceMotion: boolean;
  ambientFog: boolean;
  tutorialSeen: boolean;
  steeringSensitivity: SteeringSensitivity;
  roadAssistMode: RoadAssistMode;
  audioMasterVolume: number;
  audioEffectsVolume: number;
  audioMusicVolume: number;
  audioMuted: boolean;
  musicMuted: boolean;
  reduceAudioEffects: boolean;
  recommendedControlsPromptDismissed: boolean;
  singleDriveJoystickPromptDismissed: boolean;
  targetSpeedJoystickPromptDismissed: boolean;
}

interface SettingsStore extends VisualSettings {
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  setReduceMotion: (enabled: boolean) => void;
  setAmbientFog: (enabled: boolean) => void;
  setTutorialSeen: (seen: boolean) => void;
  setSteeringSensitivity: (sensitivity: SteeringSensitivity) => void;
  setRoadAssistMode: (mode: RoadAssistMode) => void;
  setAudioMasterVolume: (volume: number) => void;
  setAudioEffectsVolume: (volume: number) => void;
  setAudioMusicVolume: (volume: number) => void;
  setAudioMuted: (muted: boolean) => void;
  setMusicMuted: (muted: boolean) => void;
  setReduceAudioEffects: (reduced: boolean) => void;
  setMobileControlMode: (mode: MobileControlMode) => void;
  setJoystickPositionMode: (mode: JoystickPositionMode) => void;
  setJoystickSize: (size: JoystickSize) => void;
  setJoystickDeadZone: (deadZone: number) => void;
  setAutoThrottleDefault: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setRecommendedControlsPromptDismissed: (dismissed: boolean) => void;
  setSingleDriveJoystickPromptDismissed: (dismissed: boolean) => void;
  setTargetSpeedJoystickPromptDismissed: (dismissed: boolean) => void;
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
  steeringSensitivity: 'medium',
  roadAssistMode: 'soft',
  audioMasterVolume: 0.7,
  audioEffectsVolume: 0.8,
  audioMusicVolume: 0.42,
  audioMuted: false,
  musicMuted: false,
  reduceAudioEffects: false,
  recommendedControlsPromptDismissed: true,
  singleDriveJoystickPromptDismissed: true,
  targetSpeedJoystickPromptDismissed: true,
  ...defaultMobileControlsSettings,
};

function volume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isSteeringSensitivity(value: unknown): value is SteeringSensitivity {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isRoadAssistMode(value: unknown): value is RoadAssistMode {
  return value === 'off' || value === 'soft' || value === 'strong';
}

function isMobileControlMode(value: unknown): value is MobileControlMode {
  return (
    value === 'single-drive-joystick' ||
    value === 'target-speed-joystick' ||
    value === 'joystick-pedals' ||
    value === 'joystick-auto-throttle' ||
    value === 'classic-buttons'
  );
}

function isJoystickPositionMode(value: unknown): value is JoystickPositionMode {
  return value === 'fixed' || value === 'floating';
}

function isJoystickSize(value: unknown): value is JoystickSize {
  return value === 'small' || value === 'medium' || value === 'large';
}

function joystickDeadZone(
  value: unknown,
  fallback = defaultMobileControlsSettings.joystickDeadZone,
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0.05, Math.min(0.3, value))
    : fallback;
}

export function parseVisualSettings(raw: string): VisualSettings | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isRecord(parsed) ||
    (parsed.version !== 1 &&
      parsed.version !== 2 &&
      parsed.version !== 3 &&
      parsed.version !== 4 &&
      parsed.version !== 5 &&
      parsed.version !== 6 &&
      parsed.version !== 7 &&
      parsed.version !== SETTINGS_VERSION)
  ) {
    return null;
  }
  const value = parsed.settings;
  if (!isRecord(value)) return null;

  return {
    graphicsQuality: isGraphicsQuality(value.graphicsQuality)
      ? value.graphicsQuality
      : defaultSettings.graphicsQuality,
    reduceMotion: value.reduceMotion === true,
    ambientFog: value.ambientFog !== false,
    tutorialSeen: value.tutorialSeen === true,
    steeringSensitivity: isSteeringSensitivity(value.steeringSensitivity)
      ? value.steeringSensitivity
      : defaultSettings.steeringSensitivity,
    roadAssistMode: isRoadAssistMode(value.roadAssistMode)
      ? value.roadAssistMode
      : defaultSettings.roadAssistMode,
    audioMasterVolume: volume(
      value.audioMasterVolume,
      defaultSettings.audioMasterVolume,
    ),
    audioEffectsVolume: volume(
      value.audioEffectsVolume,
      defaultSettings.audioEffectsVolume,
    ),
    audioMusicVolume: volume(
      value.audioMusicVolume,
      defaultSettings.audioMusicVolume,
    ),
    audioMuted: value.audioMuted === true,
    musicMuted: value.musicMuted === true,
    reduceAudioEffects: value.reduceAudioEffects === true,
    controlMode: isMobileControlMode(value.controlMode)
      ? value.controlMode
      : parsed.version === SETTINGS_VERSION
        ? defaultMobileControlsSettings.controlMode
        : parsed.version === 7
          ? 'single-drive-joystick'
          : 'joystick-pedals',
    joystickPositionMode: isJoystickPositionMode(value.joystickPositionMode)
      ? value.joystickPositionMode
      : defaultMobileControlsSettings.joystickPositionMode,
    joystickSize: isJoystickSize(value.joystickSize)
      ? value.joystickSize
      : defaultMobileControlsSettings.joystickSize,
    joystickDeadZone: joystickDeadZone(
      value.joystickDeadZone,
      parsed.version === SETTINGS_VERSION || parsed.version === 7
        ? undefined
        : 0.14,
    ),
    autoThrottleDefault: value.autoThrottleDefault === true,
    hapticsEnabled: value.hapticsEnabled !== false,
    recommendedControlsPromptDismissed:
      value.recommendedControlsPromptDismissed === true ||
      (value.recommendedControlsPromptDismissed !== false &&
        isMobileControlMode(value.controlMode) &&
        value.controlMode !== 'joystick-pedals'),
    singleDriveJoystickPromptDismissed:
      (parsed.version === SETTINGS_VERSION || parsed.version === 7) &&
      value.singleDriveJoystickPromptDismissed === true,
    targetSpeedJoystickPromptDismissed:
      parsed.version === SETTINGS_VERSION &&
      value.targetSpeedJoystickPromptDismissed === true,
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
    steeringSensitivity: state.steeringSensitivity,
    roadAssistMode: state.roadAssistMode,
    audioMasterVolume: state.audioMasterVolume,
    audioEffectsVolume: state.audioEffectsVolume,
    audioMusicVolume: state.audioMusicVolume,
    audioMuted: state.audioMuted,
    musicMuted: state.musicMuted,
    reduceAudioEffects: state.reduceAudioEffects,
    recommendedControlsPromptDismissed:
      state.recommendedControlsPromptDismissed,
    singleDriveJoystickPromptDismissed:
      state.singleDriveJoystickPromptDismissed,
    targetSpeedJoystickPromptDismissed:
      state.targetSpeedJoystickPromptDismissed,
    controlMode: state.controlMode,
    joystickPositionMode: state.joystickPositionMode,
    joystickSize: state.joystickSize,
    joystickDeadZone: state.joystickDeadZone,
    autoThrottleDefault: state.autoThrottleDefault,
    hapticsEnabled: state.hapticsEnabled,
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
  setSteeringSensitivity: (steeringSensitivity) =>
    set((state) => {
      const next = { ...visualSettings(state), steeringSensitivity };
      saveVisualSettings(next);
      return next;
    }),
  setRoadAssistMode: (roadAssistMode) =>
    set((state) => {
      const next = { ...visualSettings(state), roadAssistMode };
      saveVisualSettings(next);
      return next;
    }),
  setAudioMasterVolume: (audioMasterVolume) =>
    set((state) => {
      const next = {
        ...visualSettings(state),
        audioMasterVolume: volume(audioMasterVolume, state.audioMasterVolume),
      };
      saveVisualSettings(next);
      return next;
    }),
  setAudioEffectsVolume: (audioEffectsVolume) =>
    set((state) => {
      const next = {
        ...visualSettings(state),
        audioEffectsVolume: volume(
          audioEffectsVolume,
          state.audioEffectsVolume,
        ),
      };
      saveVisualSettings(next);
      return next;
    }),
  setAudioMusicVolume: (audioMusicVolume) =>
    set((state) => {
      const next = {
        ...visualSettings(state),
        audioMusicVolume: volume(audioMusicVolume, state.audioMusicVolume),
      };
      saveVisualSettings(next);
      return next;
    }),
  setAudioMuted: (audioMuted) =>
    set((state) => {
      const next = { ...visualSettings(state), audioMuted };
      saveVisualSettings(next);
      return next;
    }),
  setMusicMuted: (musicMuted) =>
    set((state) => {
      const next = { ...visualSettings(state), musicMuted };
      saveVisualSettings(next);
      return next;
    }),
  setReduceAudioEffects: (reduceAudioEffects) =>
    set((state) => {
      const next = { ...visualSettings(state), reduceAudioEffects };
      saveVisualSettings(next);
      return next;
    }),
  setMobileControlMode: (controlMode) =>
    set((state) => {
      const next = {
        ...visualSettings(state),
        controlMode,
        recommendedControlsPromptDismissed: true,
        singleDriveJoystickPromptDismissed: true,
        targetSpeedJoystickPromptDismissed: true,
      };
      saveVisualSettings(next);
      return next;
    }),
  setJoystickPositionMode: (joystickPositionMode) =>
    set((state) => {
      const next = { ...visualSettings(state), joystickPositionMode };
      saveVisualSettings(next);
      return next;
    }),
  setJoystickSize: (joystickSize) =>
    set((state) => {
      const next = { ...visualSettings(state), joystickSize };
      saveVisualSettings(next);
      return next;
    }),
  setJoystickDeadZone: (value) =>
    set((state) => {
      const next = {
        ...visualSettings(state),
        joystickDeadZone: joystickDeadZone(value),
      };
      saveVisualSettings(next);
      return next;
    }),
  setAutoThrottleDefault: (autoThrottleDefault) =>
    set((state) => {
      const next = { ...visualSettings(state), autoThrottleDefault };
      saveVisualSettings(next);
      return next;
    }),
  setHapticsEnabled: (hapticsEnabled) =>
    set((state) => {
      const next = { ...visualSettings(state), hapticsEnabled };
      saveVisualSettings(next);
      return next;
    }),
  setRecommendedControlsPromptDismissed: (recommendedControlsPromptDismissed) =>
    set((state) => {
      const next = {
        ...visualSettings(state),
        recommendedControlsPromptDismissed,
      };
      saveVisualSettings(next);
      return next;
    }),
  setSingleDriveJoystickPromptDismissed: (singleDriveJoystickPromptDismissed) =>
    set((state) => {
      const next = {
        ...visualSettings(state),
        singleDriveJoystickPromptDismissed,
      };
      saveVisualSettings(next);
      return next;
    }),
  setTargetSpeedJoystickPromptDismissed: (
    targetSpeedJoystickPromptDismissed,
  ) =>
    set((state) => {
      const next = {
        ...visualSettings(state),
        targetSpeedJoystickPromptDismissed,
      };
      saveVisualSettings(next);
      return next;
    }),
}));

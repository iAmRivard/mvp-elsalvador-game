// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  parseVisualSettings,
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
} from '../src/store/settingsStore';

describe('configuración visual', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      graphicsQuality: 'medium',
      reduceMotion: false,
      ambientFog: true,
      tutorialSeen: false,
      steeringSensitivity: 'medium',
      roadAssistMode: 'soft',
      audioMasterVolume: 0.7,
      audioEffectsVolume: 0.8,
      audioMuted: false,
      reduceAudioEffects: false,
    });
  });

  it('valida el formato versionado y rechaza datos inválidos', () => {
    expect(parseVisualSettings('{roto')).toBeNull();
    expect(parseVisualSettings(JSON.stringify({ version: 99 }))).toBeNull();
    expect(
      parseVisualSettings(
        JSON.stringify({
          version: 3,
          settings: {
            graphicsQuality: 'high',
            reduceMotion: true,
            ambientFog: false,
            tutorialSeen: true,
            steeringSensitivity: 'high',
            roadAssistMode: 'strong',
          },
        }),
      ),
    ).toEqual({
      graphicsQuality: 'high',
      reduceMotion: true,
      ambientFog: false,
      tutorialSeen: true,
      steeringSensitivity: 'high',
      roadAssistMode: 'strong',
      audioMasterVolume: 0.7,
      audioEffectsVolume: 0.8,
      audioMuted: false,
      reduceAudioEffects: false,
    });
  });

  it('migra preferencias version 1 con sensibilidad equilibrada', () => {
    expect(
      parseVisualSettings(
        JSON.stringify({
          version: 1,
          settings: {
            graphicsQuality: 'low',
            reduceMotion: false,
            ambientFog: true,
            tutorialSeen: true,
          },
        }),
      ),
    ).toMatchObject({
      graphicsQuality: 'low',
      tutorialSeen: true,
      steeringSensitivity: 'medium',
      roadAssistMode: 'soft',
    });
  });

  it('persiste cambios de calidad, atmósfera y tutorial', () => {
    useSettingsStore.getState().setGraphicsQuality('low');
    useSettingsStore.getState().setAmbientFog(false);
    useSettingsStore.getState().setTutorialSeen(true);
    useSettingsStore.getState().setSteeringSensitivity('high');
    useSettingsStore.getState().setRoadAssistMode('off');
    useSettingsStore.getState().setAudioMasterVolume(0.45);
    useSettingsStore.getState().setAudioEffectsVolume(0.6);
    useSettingsStore.getState().setAudioMuted(true);
    useSettingsStore.getState().setReduceAudioEffects(true);

    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(parseVisualSettings(raw!)).toMatchObject({
      graphicsQuality: 'low',
      ambientFog: false,
      tutorialSeen: true,
      steeringSensitivity: 'high',
      roadAssistMode: 'off',
      audioMasterVolume: 0.45,
      audioEffectsVolume: 0.6,
      audioMuted: true,
      reduceAudioEffects: true,
    });
  });

  it('sanea los niveles de audio de la versión 4', () => {
    expect(
      parseVisualSettings(
        JSON.stringify({
          version: 4,
          settings: {
            graphicsQuality: 'medium',
            audioMasterVolume: 5,
            audioEffectsVolume: -2,
            audioMuted: true,
            reduceAudioEffects: true,
          },
        }),
      ),
    ).toMatchObject({
      audioMasterVolume: 1,
      audioEffectsVolume: 0,
      audioMuted: true,
      reduceAudioEffects: true,
    });
  });
});

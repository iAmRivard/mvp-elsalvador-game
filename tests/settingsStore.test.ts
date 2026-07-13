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
    });
  });

  it('valida el formato versionado y rechaza datos inválidos', () => {
    expect(parseVisualSettings('{roto')).toBeNull();
    expect(parseVisualSettings(JSON.stringify({ version: 99 }))).toBeNull();
    expect(
      parseVisualSettings(
        JSON.stringify({
          version: 1,
          settings: {
            graphicsQuality: 'high',
            reduceMotion: true,
            ambientFog: false,
            tutorialSeen: true,
          },
        }),
      ),
    ).toEqual({
      graphicsQuality: 'high',
      reduceMotion: true,
      ambientFog: false,
      tutorialSeen: true,
    });
  });

  it('persiste cambios de calidad, atmósfera y tutorial', () => {
    useSettingsStore.getState().setGraphicsQuality('low');
    useSettingsStore.getState().setAmbientFog(false);
    useSettingsStore.getState().setTutorialSeen(true);

    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(parseVisualSettings(raw!)).toMatchObject({
      graphicsQuality: 'low',
      ambientFog: false,
      tutorialSeen: true,
    });
  });
});

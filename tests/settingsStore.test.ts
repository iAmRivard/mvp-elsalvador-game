// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  parseVisualSettings,
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
} from '../src/store/settingsStore';
import { defaultMobileControlsSettings } from '../src/config/mobileControls.config';

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
      audioMusicVolume: 0.42,
      audioMuted: false,
      musicMuted: false,
      reduceAudioEffects: false,
      recommendedControlsPromptDismissed: false,
      singleDriveJoystickPromptDismissed: false,
      targetSpeedJoystickPromptDismissed: false,
      arcadeDrivingPromptDismissed: false,
      controlMode: 'joystick-pedals',
      joystickPositionMode: 'fixed',
      joystickSize: 'medium',
      joystickDeadZone: 0.14,
      autoThrottleDefault: false,
      hapticsEnabled: true,
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
      audioMusicVolume: 0.42,
      audioMuted: false,
      musicMuted: false,
      reduceAudioEffects: false,
      recommendedControlsPromptDismissed: false,
      singleDriveJoystickPromptDismissed: false,
      targetSpeedJoystickPromptDismissed: false,
      arcadeDrivingPromptDismissed: false,
      controlMode: 'joystick-pedals',
      joystickPositionMode: 'fixed',
      joystickSize: 'medium',
      joystickDeadZone: 0.14,
      autoThrottleDefault: false,
      hapticsEnabled: true,
    });
  });

  it('usa conducción arcade en instalaciones nuevas y conserva modos existentes', () => {
    expect(defaultMobileControlsSettings.controlMode).toBe(
      'arcade-driving',
    );
    expect(
      parseVisualSettings(
        JSON.stringify({ version: 5, settings: { graphicsQuality: 'medium' } }),
      )?.controlMode,
    ).toBe('joystick-pedals');
    expect(
      parseVisualSettings(
        JSON.stringify({
          version: 5,
          settings: {
            graphicsQuality: 'medium',
            controlMode: 'joystick-pedals',
          },
        }),
      )?.recommendedControlsPromptDismissed,
    ).toBe(false);
    expect(
      parseVisualSettings(
        JSON.stringify({
          version: 7,
          settings: {
            graphicsQuality: 'medium',
            controlMode: 'classic-buttons',
            singleDriveJoystickPromptDismissed: true,
          },
        }),
      ),
    ).toMatchObject({
      controlMode: 'classic-buttons',
      singleDriveJoystickPromptDismissed: true,
      targetSpeedJoystickPromptDismissed: false,
    });
    expect(
      parseVisualSettings(
        JSON.stringify({
          version: 8,
          settings: {
            graphicsQuality: 'medium',
            controlMode: 'target-speed-joystick',
            targetSpeedJoystickPromptDismissed: true,
          },
        }),
      ),
    ).toMatchObject({
      controlMode: 'target-speed-joystick',
      targetSpeedJoystickPromptDismissed: true,
      arcadeDrivingPromptDismissed: false,
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
    useSettingsStore.getState().setAudioMusicVolume(0.35);
    useSettingsStore.getState().setAudioMuted(true);
    useSettingsStore.getState().setMusicMuted(true);
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
      audioMusicVolume: 0.35,
      audioMuted: true,
      musicMuted: true,
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

  it('migra preferencias móviles y sanea la versión 5', () => {
    expect(
      parseVisualSettings(
        JSON.stringify({
          version: 5,
          settings: {
            graphicsQuality: 'medium',
            controlMode: 'joystick-auto-throttle',
            joystickPositionMode: 'floating',
            joystickSize: 'large',
            joystickDeadZone: 4,
            autoThrottleDefault: true,
            hapticsEnabled: false,
          },
        }),
      ),
    ).toMatchObject({
      controlMode: 'joystick-auto-throttle',
      joystickPositionMode: 'floating',
      joystickSize: 'large',
      joystickDeadZone: 0.3,
      autoThrottleDefault: true,
      hapticsEnabled: false,
    });

    useSettingsStore.getState().setMobileControlMode('classic-buttons');
    useSettingsStore.getState().setJoystickSize('small');
    useSettingsStore.getState().setJoystickDeadZone(0.2);
    expect(
      parseVisualSettings(
        window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '',
      ),
    ).toMatchObject({
      controlMode: 'classic-buttons',
      joystickSize: 'small',
      joystickDeadZone: 0.2,
    });
  });
});

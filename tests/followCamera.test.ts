import { describe, expect, it } from 'vitest';
import { drivingCameraProfiles } from '../src/config/followCamera.config';
import {
  drivingCameraProfile,
  followCameraOffset,
  followCameraTarget,
  smoothFollowBearing,
} from '../src/game/followCamera';

describe('cámara de seguimiento', () => {
  it('selecciona perfiles cercanos por estado y dispositivo', () => {
    expect(followCameraTarget('stopped')).toEqual({
      zoom: drivingCameraProfiles.stopped.zoom,
      pitch: drivingCameraProfiles.stopped.pitch,
    });
    expect(followCameraTarget('driving').zoom).toBeLessThan(
      drivingCameraProfiles.stopped.zoom,
    );
    expect(followCameraTarget('fast')).toEqual({
      zoom: drivingCameraProfiles.fast.zoom,
      pitch: drivingCameraProfiles.fast.pitch,
    });
    expect(drivingCameraProfile('driving', true)).toBe(
      drivingCameraProfiles.mobileDriving,
    );
    expect(drivingCameraProfiles.mobileFast.zoom).toBeGreaterThanOrEqual(15);
  });

  it('coloca el jugador debajo del centro mediante el ratio del perfil', () => {
    expect(followCameraOffset(1440, 900, 0.21)).toEqual([0, 189]);
    expect(followCameraOffset(390, 844, 0.24)).toEqual([0, 203]);
    expect(followCameraOffset(844, 390, 0.26)).toEqual([0, 101]);
  });

  it('limita el cambio de rumbo y cruza correctamente el norte', () => {
    expect(smoothFollowBearing(20, 90, 12)).toBe(32);
    expect(smoothFollowBearing(355, 5, 12)).toBe(5);
    expect(smoothFollowBearing(Number.NaN, 180, 12)).toBe(180);
  });
});

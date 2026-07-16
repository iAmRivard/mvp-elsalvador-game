import { describe, expect, it } from 'vitest';
import {
  drivingCameraProfiles,
  followCameraTolerances,
  mobileCameraHysteresis,
} from '../src/config/followCamera.config';
import {
  cameraProfileSpeedChangedSignificantly,
  drivingCameraProfile,
  followCameraOffset,
  followCameraTarget,
  followCameraUpdateIsSignificant,
  mobileCameraModeForSpeed,
  settledMobileCameraModeForSpeed,
  smoothFollowBearing,
  type FollowCameraOptions,
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
    expect(drivingCameraProfiles.mobileStopped.updateIntervalMilliseconds).toBe(
      33,
    );
    expect(drivingCameraProfiles.mobileDriving.updateIntervalMilliseconds).toBe(
      33,
    );
    expect(drivingCameraProfiles.mobileFast.updateIntervalMilliseconds).toBe(
      33,
    );
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

  it('omite cambios de cámara dentro de tolerancias configuradas', () => {
    const previous: FollowCameraOptions = {
      center: [-89.19, 13.69],
      bearing: 359.9,
      zoom: 15.4,
      pitch: 59,
      offset: [0, 203],
    };
    expect(
      followCameraUpdateIsSignificant(
        previous,
        {
          center: [-89.19000005, 13.69000005],
          bearing: 0.1,
          zoom: 15.405,
          pitch: 59.05,
          offset: [0, 203.5],
        },
        followCameraTolerances,
      ),
    ).toBe(false);
  });

  it('aplica cambios significativos de rumbo y posición', () => {
    const previous: FollowCameraOptions = {
      center: [-89.19, 13.69],
      bearing: 20,
      zoom: 15.4,
      pitch: 59,
      offset: [0, 203],
    };
    expect(
      followCameraUpdateIsSignificant(
        previous,
        { ...previous, bearing: 21 },
        followCameraTolerances,
      ),
    ).toBe(true);
    expect(
      followCameraUpdateIsSignificant(
        previous,
        {
          ...previous,
          center: [
            previous.center[0] +
              followCameraTolerances.minimumCoordinateDeltaDegrees,
            previous.center[1],
          ],
        },
        followCameraTolerances,
      ),
    ).toBe(true);
  });

  it('mantiene driving ante picos cortos y entra a fast con velocidad sostenida', () => {
    const base = {
      speedKilometersPerHour: 86,
      previousMode: 'driving' as const,
      hasAlert: false,
      hasInteraction: false,
    };
    expect(
      mobileCameraModeForSpeed({
        ...base,
        timeInStateMilliseconds:
          mobileCameraHysteresis.fastEnterDelayMilliseconds - 1,
      }),
    ).toBe('driving');
    expect(
      mobileCameraModeForSpeed({
        ...base,
        timeInStateMilliseconds:
          mobileCameraHysteresis.fastEnterDelayMilliseconds,
      }),
    ).toBe('fast');
  });

  it('usa histéresis al volver de fast y no deja que alertas alteren el zoom', () => {
    expect(
      mobileCameraModeForSpeed({
        speedKilometersPerHour: 76,
        previousMode: 'fast',
        timeInStateMilliseconds: 10_000,
        hasAlert: true,
        hasInteraction: false,
      }),
    ).toBe('fast');
    expect(
      mobileCameraModeForSpeed({
        speedKilometersPerHour: 73,
        previousMode: 'fast',
        timeInStateMilliseconds:
          mobileCameraHysteresis.fastExitDelayMilliseconds - 1,
        hasAlert: false,
        hasInteraction: false,
      }),
    ).toBe('fast');
    expect(
      mobileCameraModeForSpeed({
        speedKilometersPerHour: 73,
        previousMode: 'fast',
        timeInStateMilliseconds:
          mobileCameraHysteresis.fastExitDelayMilliseconds,
        hasAlert: false,
        hasInteraction: false,
      }),
    ).toBe('driving');
  });

  it('mantiene una cámara cercana durante interacción lenta', () => {
    expect(
      mobileCameraModeForSpeed({
        speedKilometersPerHour: 5,
        previousMode: 'driving',
        timeInStateMilliseconds:
          mobileCameraHysteresis.stoppedTransitionDelayMilliseconds,
        hasAlert: false,
        hasInteraction: true,
      }),
    ).toBe('stopped');
  });

  it('filtra variaciones pequeñas de velocidad para el perfil', () => {
    expect(
      cameraProfileSpeedChangedSignificantly(60, 60.2, followCameraTolerances),
    ).toBe(false);
    expect(
      cameraProfileSpeedChangedSignificantly(60, 60.5, followCameraTolerances),
    ).toBe(true);
  });

  it('settles from fast to stopped after a restore', () => {
    expect(
      settledMobileCameraModeForSpeed({
        speedKilometersPerHour: 0,
        previousMode: 'fast',
        timeInStateMilliseconds: 0,
        hasAlert: false,
        hasInteraction: false,
      }),
    ).toBe('stopped');
  });
});

import { describe, expect, it } from 'vitest';
import { followCameraConfig } from '../src/config/followCamera.config';
import { travelConfig } from '../src/config/travel.config';
import {
  followCameraOffset,
  followCameraTarget,
} from '../src/game/followCamera';

describe('camara de seguimiento', () => {
  it('acerca la camara al detenerse y la abre progresivamente con velocidad', () => {
    const stopped = followCameraTarget(0);
    const cruising = followCameraTarget(
      travelConfig.normalMaximumSpeedMetersPerSecond,
    );
    const boosted = followCameraTarget(
      travelConfig.boostMaximumSpeedMetersPerSecond,
    );

    expect(stopped).toEqual({
      zoom: followCameraConfig.stoppedZoom,
      pitch: followCameraConfig.minimumPitch,
    });
    expect(cruising.zoom).toBeLessThan(stopped.zoom);
    expect(cruising.pitch).toBeGreaterThan(stopped.pitch);
    expect(boosted).toEqual({
      zoom: followCameraConfig.maximumSpeedZoom,
      pitch: followCameraConfig.maximumPitch,
    });
  });

  it('usa la magnitud de velocidad y limita valores fuera del perfil', () => {
    expect(followCameraTarget(-20)).toEqual(followCameraTarget(20));
    expect(followCameraTarget(Number.NaN)).toEqual(followCameraTarget(0));
    expect(followCameraTarget(500)).toEqual(
      followCameraTarget(travelConfig.boostMaximumSpeedMetersPerSecond),
    );
  });

  it('coloca el jugador debajo del centro en escritorio y movil', () => {
    const desktop = followCameraOffset(1440, 900);
    const mobilePortrait = followCameraOffset(390, 844);
    const mobileLandscape = followCameraOffset(844, 390);

    expect(desktop[0]).toBe(0);
    expect(desktop[1]).toBe(112);
    expect(mobilePortrait[1]).toBe(68);
    expect(mobileLandscape[1]).toBe(39);
  });
});

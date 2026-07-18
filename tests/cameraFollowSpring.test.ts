import { describe, expect, it } from 'vitest';
import { followCameraConfig } from '../src/config/followCamera.config';
import {
  advanceCameraFollowSpring,
  initialCameraFollowSpringState,
} from '../src/game/cameraFollowSpring';

const zone = followCameraConfig.mobileFollowZone;

describe('zona acotada de seguimiento de cámara', () => {
  it('permite movimiento dentro de los límites sin corregir la cámara', () => {
    const initialized = advanceCameraFollowSpring(
      initialCameraFollowSpringState,
      {
        observedOffsetXPixels: 0,
        observedOffsetYPixels: 0,
        elapsedMilliseconds: 16,
        zone,
      },
    ).state;
    const result = advanceCameraFollowSpring(initialized, {
      observedOffsetXPixels: 12,
      observedOffsetYPixels: -8,
      elapsedMilliseconds: 16,
      zone,
    });

    expect(result.cameraCorrectionXPixels).toBe(0);
    expect(result.cameraCorrectionYPixels).toBe(0);
    expect(result.state.offsetXPixels).toBe(12);
    expect(result.state.offsetYPixels).toBe(-8);
    expect(result.insideZone).toBe(true);
  });

  it('corrige de forma monotónica y dependiente del tiempo fuera de la zona', () => {
    const initialized = {
      ...initialCameraFollowSpringState,
      initialized: true,
    };
    const shortStep = advanceCameraFollowSpring(initialized, {
      observedOffsetXPixels: 22,
      observedOffsetYPixels: 20,
      elapsedMilliseconds: 16,
      zone,
    });
    const longStep = advanceCameraFollowSpring(initialized, {
      observedOffsetXPixels: 22,
      observedOffsetYPixels: 20,
      elapsedMilliseconds: 50,
      zone,
    });

    expect(shortStep.state.offsetXPixels).toBeLessThanOrEqual(
      zone.horizontalRadiusPixels + zone.maximumOverflowPixels,
    );
    expect(longStep.state.offsetXPixels).toBeLessThan(
      shortStep.state.offsetXPixels,
    );
    expect(longStep.cameraCorrectionXPixels).toBeGreaterThan(
      shortStep.cameraCorrectionXPixels,
    );
  });

  it('hace snap al cargar, reincorporar o detectar un teleport', () => {
    const initialized = {
      ...initialCameraFollowSpringState,
      initialized: true,
    };
    const explicit = advanceCameraFollowSpring(initialized, {
      observedOffsetXPixels: 20,
      observedOffsetYPixels: 10,
      elapsedMilliseconds: 16,
      zone,
      snap: true,
    });
    const teleport = advanceCameraFollowSpring(initialized, {
      observedOffsetXPixels: zone.snapDistancePixels,
      observedOffsetYPixels: 0,
      elapsedMilliseconds: 16,
      zone,
    });

    expect(explicit.snapped).toBe(true);
    expect(explicit.state.offsetXPixels).toBe(0);
    expect(teleport.snapped).toBe(true);
    expect(teleport.state.offsetXPixels).toBe(0);
  });

  it('no oscila ni deriva al permanecer detenido', () => {
    const state = {
      offsetXPixels: 5,
      offsetYPixels: -4,
      initialized: true,
    };
    const result = advanceCameraFollowSpring(state, {
      observedOffsetXPixels: 5,
      observedOffsetYPixels: -4,
      elapsedMilliseconds: 100,
      zone,
    });

    expect(result.state).toEqual(state);
    expect(result.cameraCorrectionXPixels).toBe(0);
    expect(result.cameraCorrectionYPixels).toBe(0);
  });

  it('reduced motion elimina el asentamiento elástico innecesario', () => {
    const result = advanceCameraFollowSpring(
      { ...initialCameraFollowSpringState, initialized: true },
      {
        observedOffsetXPixels: 40,
        observedOffsetYPixels: 24,
        elapsedMilliseconds: 16,
        zone,
        reducedMotion: true,
      },
    );

    expect(result.state.offsetXPixels).toBe(zone.horizontalRadiusPixels);
    expect(result.state.offsetYPixels).toBe(zone.verticalRadiusPixels);
    expect(result.insideZone).toBe(true);
  });
});

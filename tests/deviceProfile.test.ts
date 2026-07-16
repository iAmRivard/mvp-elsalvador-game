import { describe, expect, it } from 'vitest';
import { resolveDeviceProfile } from '../src/game/deviceProfile';

describe('perfil de dispositivo', () => {
  it('conserva calidad media y antialias en un escritorio capaz', () => {
    const profile = resolveDeviceProfile({
      width: 1440,
      height: 900,
      coarsePointer: false,
      reducedMotion: false,
      hardwareConcurrency: 8,
      deviceMemoryGigabytes: 16,
      devicePixelRatio: 2.5,
      configuredQuality: 'medium',
    });

    expect(profile.quality).toBe('medium');
    expect(profile.isCompact).toBe(false);
    expect(profile.antialias).toBe(true);
    expect(profile.pixelRatio).toBe(2);
    expect(profile.cameraUpdateIntervalMilliseconds).toBe(33);
    expect(profile.cameraDurationMilliseconds).toBe(40);
    expect(profile.maximumInitialPitch).toBe(62);
  });

  it('reduce automáticamente la carga en hardware limitado', () => {
    const profile = resolveDeviceProfile({
      width: 390,
      height: 844,
      coarsePointer: true,
      reducedMotion: false,
      hardwareConcurrency: 4,
      deviceMemoryGigabytes: 4,
      devicePixelRatio: 3,
      configuredQuality: 'medium',
    });

    expect(profile.quality).toBe('low');
    expect(profile.isTouch).toBe(true);
    expect(profile.isCompact).toBe(true);
    expect(profile.antialias).toBe(false);
    expect(profile.pixelRatio).toBe(1);
    expect(profile.mapDataUpdateIntervalMilliseconds).toBe(250);
    expect(profile.cameraUpdateIntervalMilliseconds).toBe(50);
    expect(profile.cameraDurationMilliseconds).toBe(50);
    expect(profile.maximumInitialPitch).toBe(58);
  });

  it('actualiza cámara táctil media aproximadamente a 30 Hz', () => {
    const profile = resolveDeviceProfile({
      width: 392,
      height: 850,
      coarsePointer: true,
      reducedMotion: false,
      hardwareConcurrency: 8,
      deviceMemoryGigabytes: 8,
      devicePixelRatio: 3,
      configuredQuality: 'medium',
    });

    expect(profile.quality).toBe('medium');
    expect(profile.cameraUpdateIntervalMilliseconds).toBe(33);
  });

  it('respeta movimiento reducido y una selección explícita alta', () => {
    const profile = resolveDeviceProfile({
      width: 844,
      height: 390,
      coarsePointer: true,
      reducedMotion: true,
      hardwareConcurrency: 2,
      deviceMemoryGigabytes: 2,
      devicePixelRatio: 3,
      configuredQuality: 'high',
    });

    expect(profile.quality).toBe('high');
    expect(profile.isCompact).toBe(true);
    expect(profile.cameraDurationMilliseconds).toBe(0);
    expect(profile.fadeDurationMilliseconds).toBe(0);
    expect(profile.pixelRatio).toBe(2);
    expect(profile.cameraUpdateIntervalMilliseconds).toBe(33);
    expect(profile.maximumInitialPitch).toBe(61);
  });
});

import type { GraphicsQuality } from '../config/game.config';

export interface DeviceSignals {
  width: number;
  height: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
  hardwareConcurrency: number;
  deviceMemoryGigabytes?: number;
  devicePixelRatio: number;
  configuredQuality: GraphicsQuality;
}

export interface DeviceProfile {
  quality: GraphicsQuality;
  isTouch: boolean;
  isCompact: boolean;
  reducedMotion: boolean;
  antialias: boolean;
  pixelRatio: number;
  maximumInitialPitch: number;
  cameraUpdateIntervalMilliseconds: number;
  cameraDurationMilliseconds: number;
  mapDataUpdateIntervalMilliseconds: number;
  fadeDurationMilliseconds: number;
}

export function resolveDeviceProfile(signals: DeviceSignals): DeviceProfile {
  const constrainedHardware =
    signals.hardwareConcurrency <= 4 ||
    (signals.deviceMemoryGigabytes !== undefined &&
      signals.deviceMemoryGigabytes <= 4);
  const quality =
    signals.configuredQuality === 'medium' && constrainedHardware
      ? 'low'
      : signals.configuredQuality;
  const isCompact = signals.width <= 600 || signals.height <= 560;
  const pixelRatioLimit =
    quality === 'low'
      ? 1
      : quality === 'high'
        ? 2
        : signals.coarsePointer
          ? 1.5
          : 2;

  return {
    quality,
    isTouch: signals.coarsePointer,
    isCompact,
    reducedMotion: signals.reducedMotion,
    antialias:
      quality === 'high' || (quality === 'medium' && !signals.coarsePointer),
    pixelRatio: Math.max(
      1,
      Math.min(signals.devicePixelRatio, pixelRatioLimit),
    ),
    maximumInitialPitch: quality === 'low' ? 58 : isCompact ? 61 : 62,
    cameraUpdateIntervalMilliseconds: quality === 'low' ? 50 : 33,
    cameraDurationMilliseconds: signals.reducedMotion
      ? 0
      : quality === 'low'
        ? 50
        : signals.coarsePointer
          ? 60
          : 40,
    mapDataUpdateIntervalMilliseconds:
      quality === 'low' ? 250 : signals.coarsePointer ? 140 : 100,
    fadeDurationMilliseconds: signals.reducedMotion
      ? 0
      : quality === 'low'
        ? 100
        : 300,
  };
}

export function detectDeviceProfile(
  configuredQuality: GraphicsQuality,
  reduceMotionOverride = false,
): DeviceProfile {
  const navigatorWithMemory = navigator as Navigator & {
    deviceMemory?: number;
  };

  return resolveDeviceProfile({
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    reducedMotion:
      reduceMotionOverride ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemoryGigabytes: navigatorWithMemory.deviceMemory,
    devicePixelRatio: window.devicePixelRatio || 1,
    configuredQuality,
  });
}

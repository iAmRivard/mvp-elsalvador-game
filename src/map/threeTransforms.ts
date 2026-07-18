import type { GraphicsQuality } from '../config/game.config';

const WORLD_SIZE_AT_ZOOM_ZERO = 512;

export function normalizedHeadingRadians(headingDegrees: number): number {
  const normalized = ((headingDegrees % 360) + 360) % 360;
  return (normalized * Math.PI) / 180;
}

export function mercatorScaleForScreenSize(
  zoom: number,
  targetPixels: number,
  modelLengthUnits: number,
): number {
  const safeZoom = Number.isFinite(zoom) ? Math.max(0, zoom) : 0;
  const safePixels = Math.max(1, targetPixels);
  const safeLength = Math.max(0.001, modelLengthUnits);
  const worldSize = WORLD_SIZE_AT_ZOOM_ZERO * 2 ** safeZoom;
  return safePixels / worldSize / safeLength;
}

export function threePlayerTargetPixels(
  quality: GraphicsQuality,
  mobile = false,
): number {
  if (quality === 'high') return mobile ? 48 : 42;
  if (quality === 'medium') return mobile ? 44 : 34;
  return 0;
}

export function threeSignalTargetPixels(quality: GraphicsQuality): number {
  return quality === 'high' ? 52 : 44;
}

export function shouldUseThreePlayer(
  enabled: boolean,
  quality: GraphicsQuality,
): boolean {
  return enabled && quality !== 'low';
}

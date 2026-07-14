import {
  followCameraConfig,
  type FollowCameraConfig,
} from '../config/followCamera.config';
import { travelConfig, type TravelConfig } from '../config/travel.config';

export interface FollowCameraTarget {
  zoom: number;
  pitch: number;
}

export type FollowCameraOffset = [horizontal: number, vertical: number];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function smoothstep(progress: number): number {
  const clamped = clamp(progress, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

export function followCameraTarget(
  speedMetersPerSecond: number,
  camera: FollowCameraConfig = followCameraConfig,
  travel: TravelConfig = travelConfig,
): FollowCameraTarget {
  const speed = Number.isFinite(speedMetersPerSecond)
    ? Math.abs(speedMetersPerSecond)
    : 0;
  const cruisingSpeed =
    travel.normalMaximumSpeedMetersPerSecond * camera.cruisingSpeedRatio;

  if (speed <= cruisingSpeed) {
    const progress = smoothstep(speed / Math.max(0.001, cruisingSpeed));
    return {
      zoom: lerp(camera.stoppedZoom, camera.cruisingZoom, progress),
      pitch: lerp(camera.minimumPitch, camera.cruisingPitch, progress),
    };
  }

  const progress = smoothstep(
    (speed - cruisingSpeed) /
      Math.max(0.001, travel.boostMaximumSpeedMetersPerSecond - cruisingSpeed),
  );
  return {
    zoom: lerp(camera.cruisingZoom, camera.maximumSpeedZoom, progress),
    pitch: lerp(camera.cruisingPitch, camera.maximumPitch, progress),
  };
}

export function followCameraOffset(
  viewportWidth: number,
  viewportHeight: number,
): FollowCameraOffset {
  const width = Math.max(320, viewportWidth);
  const height = Math.max(240, viewportHeight);
  const compact = width <= 600 || height <= 560;
  const verticalOffset = compact
    ? clamp(height * 0.1, 28, 68)
    : clamp(height * 0.14, 48, 112);

  return [0, Math.round(verticalOffset)];
}

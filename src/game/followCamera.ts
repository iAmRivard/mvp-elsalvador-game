import {
  drivingCameraProfiles,
  type DrivingCameraProfile,
  type DrivingCameraProfiles,
} from '../config/followCamera.config';
import type { DrivingPresentationMode } from './drivingPresentation';

export interface FollowCameraTarget {
  zoom: number;
  pitch: number;
}

export type FollowCameraOffset = [horizontal: number, vertical: number];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function drivingCameraProfile(
  mode: DrivingPresentationMode,
  mobile: boolean,
  profiles: DrivingCameraProfiles = drivingCameraProfiles,
): DrivingCameraProfile {
  if (mobile) {
    if (mode === 'fast') return profiles.mobileFast;
    if (mode === 'driving') return profiles.mobileDriving;
    return profiles.mobileStopped;
  }
  if (mode === 'fast') return profiles.fast;
  if (mode === 'driving') return profiles.urban;
  return profiles.stopped;
}

export function followCameraTarget(
  mode: DrivingPresentationMode,
  mobile = false,
): FollowCameraTarget {
  const profile = drivingCameraProfile(mode, mobile);
  return { zoom: profile.zoom, pitch: profile.pitch };
}

export function followCameraOffset(
  viewportWidth: number,
  viewportHeight: number,
  offsetYRatio = 0.2,
): FollowCameraOffset {
  const width = Math.max(320, viewportWidth);
  const height = Math.max(240, viewportHeight);
  const compact = width <= 600 || height <= 560;
  const verticalOffset = compact
    ? clamp(height * offsetYRatio, 44, 220)
    : clamp(height * offsetYRatio, 64, 240);

  return [0, Math.round(verticalOffset)];
}

export function smoothFollowBearing(
  previousBearing: number,
  targetBearing: number,
  maximumChangeDegrees: number,
): number {
  if (!Number.isFinite(previousBearing)) return targetBearing;
  const difference =
    ((((targetBearing - previousBearing) % 360) + 540) % 360) - 180;
  const limited = clamp(
    difference,
    -Math.abs(maximumChangeDegrees),
    Math.abs(maximumChangeDegrees),
  );
  return (((previousBearing + limited) % 360) + 360) % 360;
}

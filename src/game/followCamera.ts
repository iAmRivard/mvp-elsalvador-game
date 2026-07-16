import {
  drivingCameraProfiles,
  mobileCameraHysteresis,
  type DrivingCameraProfile,
  type DrivingCameraProfiles,
  type FollowCameraTolerances,
  type MobileCameraHysteresis,
} from '../config/followCamera.config';
import type { DrivingPresentationMode } from './drivingPresentation';

export interface FollowCameraTarget {
  zoom: number;
  pitch: number;
}

export type FollowCameraOffset = [horizontal: number, vertical: number];

export interface FollowCameraOptions {
  center: [longitude: number, latitude: number];
  bearing: number;
  zoom: number;
  pitch: number;
  offset: FollowCameraOffset;
}

export type MobileCameraMode = 'stopped' | 'driving' | 'fast';

export interface MobileCameraModeInput {
  speedKilometersPerHour: number;
  previousMode: MobileCameraMode;
  timeInStateMilliseconds: number;
  hasAlert: boolean;
  hasInteraction: boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizedSpeed(speedKilometersPerHour: number): number {
  return Number.isFinite(speedKilometersPerHour)
    ? Math.abs(speedKilometersPerHour)
    : 0;
}

export function shortestBearingDeltaDegrees(
  previousBearing: number,
  targetBearing: number,
): number {
  if (!Number.isFinite(previousBearing) || !Number.isFinite(targetBearing)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(
    ((((targetBearing - previousBearing) % 360) + 540) % 360) - 180,
  );
}

export function followCameraUpdateIsSignificant(
  previous: FollowCameraOptions | null,
  next: FollowCameraOptions,
  tolerances: FollowCameraTolerances,
): boolean {
  if (!previous) return true;
  return (
    Math.abs(next.center[0] - previous.center[0]) >=
      tolerances.minimumCoordinateDeltaDegrees ||
    Math.abs(next.center[1] - previous.center[1]) >=
      tolerances.minimumCoordinateDeltaDegrees ||
    shortestBearingDeltaDegrees(previous.bearing, next.bearing) >=
      tolerances.minimumBearingDeltaDegrees ||
    Math.abs(next.zoom - previous.zoom) >= tolerances.minimumZoomDelta ||
    Math.abs(next.pitch - previous.pitch) >=
      tolerances.minimumPitchDeltaDegrees ||
    Math.abs(next.offset[0] - previous.offset[0]) >=
      tolerances.minimumOffsetDeltaPixels ||
    Math.abs(next.offset[1] - previous.offset[1]) >=
      tolerances.minimumOffsetDeltaPixels
  );
}

export function cameraProfileSpeedChangedSignificantly(
  previousSpeedKilometersPerHour: number,
  nextSpeedKilometersPerHour: number,
  tolerances: FollowCameraTolerances,
): boolean {
  return (
    !Number.isFinite(previousSpeedKilometersPerHour) ||
    Math.abs(
      normalizedSpeed(nextSpeedKilometersPerHour) -
        normalizedSpeed(previousSpeedKilometersPerHour),
    ) >= tolerances.minimumProfileSpeedDeltaKilometersPerHour
  );
}

export function mobileCameraTransitionCandidate(
  input: MobileCameraModeInput,
  hysteresis: MobileCameraHysteresis = mobileCameraHysteresis,
): MobileCameraMode {
  const speed = normalizedSpeed(input.speedKilometersPerHour);
  if (
    input.hasInteraction &&
    speed <= hysteresis.interactionMaximumKilometersPerHour
  ) {
    return 'stopped';
  }

  switch (input.previousMode) {
    case 'stopped':
      return speed >= hysteresis.stoppedExitKilometersPerHour
        ? 'driving'
        : 'stopped';
    case 'fast':
      return speed <= hysteresis.fastExitKilometersPerHour ? 'driving' : 'fast';
    case 'driving':
      if (speed <= hysteresis.stoppedEnterKilometersPerHour) return 'stopped';
      if (
        speed >= hysteresis.fastEnterKilometersPerHour &&
        !input.hasInteraction
      ) {
        return 'fast';
      }
      return 'driving';
  }
}

export function mobileCameraModeForSpeed(
  input: MobileCameraModeInput,
  hysteresis: MobileCameraHysteresis = mobileCameraHysteresis,
): MobileCameraMode {
  const candidate = mobileCameraTransitionCandidate(input, hysteresis);
  if (candidate === input.previousMode) return input.previousMode;

  let delayMilliseconds = hysteresis.drivingTransitionDelayMilliseconds;
  if (candidate === 'stopped') {
    delayMilliseconds = hysteresis.stoppedTransitionDelayMilliseconds;
  } else if (candidate === 'fast') {
    delayMilliseconds = hysteresis.fastEnterDelayMilliseconds;
  } else if (input.previousMode === 'fast') {
    delayMilliseconds = hysteresis.fastExitDelayMilliseconds;
  }

  // Alerts affect overlay presentation, not camera distance. Keeping the flag
  // in this pure contract prevents callers from coupling both concerns later.
  void input.hasAlert;
  return input.timeInStateMilliseconds >= delayMilliseconds
    ? candidate
    : input.previousMode;
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

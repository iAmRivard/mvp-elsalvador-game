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

export interface FollowCameraMapOptions {
  center: [longitude: number, latitude: number];
  bearing: number;
  offset: FollowCameraOffset;
  zoom?: number;
  pitch?: number;
}

export type FollowCameraOmissionReason = 'within-tolerance';

export interface FollowCameraUpdateResult {
  mapOptions: FollowCameraMapOptions | null;
  appliedOptions: FollowCameraOptions | null;
  omissionReason: FollowCameraOmissionReason | null;
  changes: {
    center: boolean;
    bearing: boolean;
    zoom: boolean;
    pitch: boolean;
    offset: boolean;
  };
}

export type MobileCameraMode = 'stopped' | 'driving' | 'fast';
export type ArcadeCameraProfileOverride = 'interaction' | 'recovery' | null;

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

function cloneFollowCameraOptions(
  options: FollowCameraOptions,
): FollowCameraOptions {
  return {
    ...options,
    center: [...options.center],
    offset: [...options.offset],
  };
}

export function buildFollowCameraUpdate(
  previous: FollowCameraOptions | null,
  requested: FollowCameraOptions,
  tolerances: FollowCameraTolerances,
): FollowCameraUpdateResult {
  const changes = {
    center:
      !previous ||
      Math.abs(requested.center[0] - previous.center[0]) >=
        tolerances.minimumCoordinateDeltaDegrees ||
      Math.abs(requested.center[1] - previous.center[1]) >=
        tolerances.minimumCoordinateDeltaDegrees,
    bearing:
      !previous ||
      shortestBearingDeltaDegrees(previous.bearing, requested.bearing) >=
        tolerances.minimumBearingDeltaDegrees,
    zoom:
      !previous ||
      Math.abs(requested.zoom - previous.zoom) >=
        tolerances.minimumZoomDelta,
    pitch:
      !previous ||
      Math.abs(requested.pitch - previous.pitch) >=
        tolerances.minimumPitchDeltaDegrees,
    offset:
      !previous ||
      Math.abs(requested.offset[0] - previous.offset[0]) >=
        tolerances.minimumOffsetDeltaPixels ||
      Math.abs(requested.offset[1] - previous.offset[1]) >=
        tolerances.minimumOffsetDeltaPixels,
  };

  if (
    previous &&
    !changes.center &&
    !changes.bearing &&
    !changes.zoom &&
    !changes.pitch &&
    !changes.offset
  ) {
    return {
      mapOptions: null,
      appliedOptions: cloneFollowCameraOptions(previous),
      omissionReason: 'within-tolerance',
      changes,
    };
  }

  const appliedOptions: FollowCameraOptions = previous
    ? {
        center: changes.center
          ? [...requested.center]
          : [...previous.center],
        bearing: changes.bearing ? requested.bearing : previous.bearing,
        zoom: changes.zoom ? requested.zoom : previous.zoom,
        pitch: changes.pitch ? requested.pitch : previous.pitch,
        offset: changes.offset
          ? [...requested.offset]
          : [...previous.offset],
      }
    : cloneFollowCameraOptions(requested);
  const mapOptions: FollowCameraMapOptions = {
    center: [...appliedOptions.center],
    bearing: appliedOptions.bearing,
    offset: [...appliedOptions.offset],
  };
  if (changes.zoom) mapOptions.zoom = appliedOptions.zoom;
  if (changes.pitch) mapOptions.pitch = appliedOptions.pitch;

  return {
    mapOptions,
    appliedOptions,
    omissionReason: null,
    changes,
  };
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

export function settledMobileCameraModeForSpeed(
  input: MobileCameraModeInput,
  hysteresis: MobileCameraHysteresis = mobileCameraHysteresis,
): MobileCameraMode {
  let mode = input.previousMode;
  for (let index = 0; index < 3; index += 1) {
    const candidate = mobileCameraTransitionCandidate(
      { ...input, previousMode: mode },
      hysteresis,
    );
    if (candidate === mode) return mode;
    mode = candidate;
  }
  return mode;
}

export function drivingCameraProfile(
  mode: DrivingPresentationMode,
  mobile: boolean,
  profiles: DrivingCameraProfiles = drivingCameraProfiles,
  override: ArcadeCameraProfileOverride = null,
): DrivingCameraProfile {
  if (mobile) {
    if (override === 'interaction') return profiles.mobileInteraction;
    if (override === 'recovery') return profiles.mobileRecovery;
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
  override: ArcadeCameraProfileOverride = null,
): FollowCameraTarget {
  const profile = drivingCameraProfile(
    mode,
    mobile,
    drivingCameraProfiles,
    override,
  );
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

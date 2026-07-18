export interface DrivingCameraProfile {
  zoom: number;
  pitch: number;
  offsetYRatio: number;
  safeAnchorYRatio: number;
  updateIntervalMilliseconds: number;
  transitionDurationMilliseconds: number;
}

export interface DrivingCameraProfiles {
  stopped: DrivingCameraProfile;
  urban: DrivingCameraProfile;
  fast: DrivingCameraProfile;
  mobileStopped: DrivingCameraProfile;
  mobileDriving: DrivingCameraProfile;
  mobileFast: DrivingCameraProfile;
  mobileInteraction: DrivingCameraProfile;
  mobileRecovery: DrivingCameraProfile;
}

export interface FollowCameraTolerances {
  minimumCoordinateDeltaDegrees: number;
  minimumBearingDeltaDegrees: number;
  minimumProfileSpeedDeltaKilometersPerHour: number;
  minimumZoomDelta: number;
  minimumPitchDeltaDegrees: number;
  minimumOffsetDeltaPixels: number;
}

export interface MobileCameraHysteresis {
  stoppedEnterKilometersPerHour: number;
  stoppedExitKilometersPerHour: number;
  stoppedTransitionDelayMilliseconds: number;
  drivingTransitionDelayMilliseconds: number;
  fastEnterKilometersPerHour: number;
  fastExitKilometersPerHour: number;
  fastEnterDelayMilliseconds: number;
  fastExitDelayMilliseconds: number;
  interactionMaximumKilometersPerHour: number;
}

export const drivingCameraProfiles: DrivingCameraProfiles = {
  stopped: {
    zoom: 15.55,
    pitch: 56,
    offsetYRatio: 0.17,
    safeAnchorYRatio: 0.58,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 60,
  },
  urban: {
    zoom: 15.3,
    pitch: 60,
    offsetYRatio: 0.21,
    safeAnchorYRatio: 0.62,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 45,
  },
  fast: {
    zoom: 15.05,
    pitch: 62,
    offsetYRatio: 0.23,
    safeAnchorYRatio: 0.6,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 40,
  },
  mobileStopped: {
    zoom: 15.65,
    pitch: 55,
    offsetYRatio: 0.19,
    safeAnchorYRatio: 0.58,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 60,
  },
  mobileDriving: {
    zoom: 15.45,
    pitch: 59,
    offsetYRatio: 0.24,
    safeAnchorYRatio: 0.62,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 50,
  },
  mobileFast: {
    zoom: 15.42,
    pitch: 59.25,
    offsetYRatio: 0.26,
    safeAnchorYRatio: 0.6,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 45,
  },
  mobileInteraction: {
    zoom: 15.65,
    pitch: 55,
    offsetYRatio: 0.19,
    safeAnchorYRatio: 0.58,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 60,
  },
  mobileRecovery: {
    zoom: 15.35,
    pitch: 55,
    offsetYRatio: 0.21,
    safeAnchorYRatio: 0.6,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 80,
  },
};

export const followCameraTolerances: FollowCameraTolerances = {
  minimumCoordinateDeltaDegrees: 0.00000015,
  minimumBearingDeltaDegrees: 0.35,
  minimumProfileSpeedDeltaKilometersPerHour: 0.5,
  minimumZoomDelta: 0.01,
  minimumPitchDeltaDegrees: 0.1,
  minimumOffsetDeltaPixels: 0.75,
};

export const mobileCameraHysteresis: MobileCameraHysteresis = {
  stoppedEnterKilometersPerHour: 3.5,
  stoppedExitKilometersPerHour: 6,
  stoppedTransitionDelayMilliseconds: 900,
  drivingTransitionDelayMilliseconds: 240,
  // Keep the visual speed state and the camera profile in the same band. The
  // delay below still absorbs short spikes without leaving a fast HUD on the
  // closer cruise camera.
  fastEnterKilometersPerHour: 58,
  fastExitKilometersPerHour: 52,
  fastEnterDelayMilliseconds: 900,
  fastExitDelayMilliseconds: 650,
  interactionMaximumKilometersPerHour: 10,
};

export const followCameraConfig = {
  recenterDurationMilliseconds: 260,
  maximumBearingChangeDegrees: 12,
  metricWindowMilliseconds: 1_000,
  maximumDurationSamples: 240,
};

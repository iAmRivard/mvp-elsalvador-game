export interface DrivingCameraProfile {
  zoom: number;
  pitch: number;
  offsetYRatio: number;
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
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 60,
  },
  urban: {
    zoom: 15.3,
    pitch: 60,
    offsetYRatio: 0.21,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 45,
  },
  fast: {
    zoom: 15.05,
    pitch: 62,
    offsetYRatio: 0.23,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 40,
  },
  mobileStopped: {
    zoom: 15.65,
    pitch: 55,
    offsetYRatio: 0.19,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 60,
  },
  mobileDriving: {
    zoom: 15.45,
    pitch: 59,
    offsetYRatio: 0.24,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 50,
  },
  mobileFast: {
    zoom: 15.2,
    pitch: 61,
    offsetYRatio: 0.26,
    updateIntervalMilliseconds: 33,
    transitionDurationMilliseconds: 45,
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
  fastEnterKilometersPerHour: 84,
  fastExitKilometersPerHour: 74,
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

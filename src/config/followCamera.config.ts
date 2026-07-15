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

export const drivingCameraProfiles: DrivingCameraProfiles = {
  stopped: {
    zoom: 15.55,
    pitch: 56,
    offsetYRatio: 0.17,
    updateIntervalMilliseconds: 45,
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
    updateIntervalMilliseconds: 50,
    transitionDurationMilliseconds: 60,
  },
  mobileDriving: {
    zoom: 15.4,
    pitch: 59,
    offsetYRatio: 0.24,
    updateIntervalMilliseconds: 40,
    transitionDurationMilliseconds: 50,
  },
  mobileFast: {
    zoom: 15.15,
    pitch: 61,
    offsetYRatio: 0.26,
    updateIntervalMilliseconds: 40,
    transitionDurationMilliseconds: 45,
  },
};

// Kept as the small set of non-profile follow behavior settings.
export const followCameraConfig = {
  recenterDurationMilliseconds: 260,
  maximumBearingChangeDegrees: 12,
};

export interface FollowCameraConfig {
  stoppedZoom: number;
  cruisingZoom: number;
  maximumSpeedZoom: number;
  minimumPitch: number;
  cruisingPitch: number;
  maximumPitch: number;
  cruisingSpeedRatio: number;
  recenterDurationMilliseconds: number;
}

export const followCameraConfig: FollowCameraConfig = {
  stoppedZoom: 15.8,
  cruisingZoom: 15.3,
  maximumSpeedZoom: 14.8,
  minimumPitch: 52,
  cruisingPitch: 56,
  maximumPitch: 60,
  cruisingSpeedRatio: 0.65,
  recenterDurationMilliseconds: 260,
};

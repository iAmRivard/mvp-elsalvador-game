import { mobileCruiseConfig } from '../config/mobileControls.config';
import { clampAnalogInput } from './analogInput';

export type MobileCruiseGear = 'stopped' | 'slow' | 'cruise' | 'fast';

export interface MobileCruiseTarget {
  targetSpeedKilometersPerHour: number;
  selectedGear: MobileCruiseGear;
  braking: boolean;
  reversing: boolean;
}

export function updateCruiseTarget(
  currentTargetKilometersPerHour: number,
  verticalIntent: number,
  deltaTimeSeconds: number,
): number {
  const current = Number.isFinite(currentTargetKilometersPerHour)
    ? currentTargetKilometersPerHour
    : mobileCruiseConfig.minimumTargetSpeedKilometersPerHour;
  const intent = clampAnalogInput(verticalIntent);
  const deltaTime = Math.max(
    0,
    Number.isFinite(deltaTimeSeconds) ? deltaTimeSeconds : 0,
  );
  const rate =
    intent >= 0
      ? mobileCruiseConfig.targetIncreasePerSecond
      : mobileCruiseConfig.targetDecreasePerSecond;
  const next = current + intent * rate * deltaTime;
  return Math.min(
    mobileCruiseConfig.maximumTargetSpeedKilometersPerHour,
    Math.max(mobileCruiseConfig.minimumTargetSpeedKilometersPerHour, next),
  );
}

export function mobileCruiseGear(
  targetSpeedKilometersPerHour: number,
): MobileCruiseGear {
  if (targetSpeedKilometersPerHour <= 0.5) return 'stopped';
  if (targetSpeedKilometersPerHour <= 35) return 'slow';
  if (targetSpeedKilometersPerHour <= 65) return 'cruise';
  return 'fast';
}

export function mobileCruiseThrottle(
  target: MobileCruiseTarget,
  currentSpeedMetersPerSecond: number,
  verticalIntent: number,
): number {
  const currentSpeedKilometersPerHour = currentSpeedMetersPerSecond * 3.6;
  const intent = clampAnalogInput(verticalIntent);

  if (target.reversing) {
    return -Math.max(
      0.28,
      Math.min(1, Math.abs(intent)),
    );
  }
  if (
    target.targetSpeedKilometersPerHour <= 0.5 &&
    currentSpeedMetersPerSecond > mobileCruiseConfig.stoppedSpeedMetersPerSecond
  ) {
    return -1;
  }
  if (currentSpeedMetersPerSecond < -mobileCruiseConfig.stoppedSpeedMetersPerSecond) {
    return 1;
  }
  if (intent < 0) {
    if (
      currentSpeedKilometersPerHour >
      target.targetSpeedKilometersPerHour +
        mobileCruiseConfig.targetSpeedToleranceKilometersPerHour
    ) {
      return -Math.min(
        1,
        Math.max(
          0.25,
          (currentSpeedKilometersPerHour -
            target.targetSpeedKilometersPerHour) /
            mobileCruiseConfig.responseRangeKilometersPerHour,
        ),
      );
    }
    return 0;
  }

  const speedError =
    target.targetSpeedKilometersPerHour - currentSpeedKilometersPerHour;
  if (
    Math.abs(speedError) <=
    mobileCruiseConfig.targetSpeedToleranceKilometersPerHour
  ) {
    return target.targetSpeedKilometersPerHour /
      mobileCruiseConfig.maximumTargetSpeedKilometersPerHour;
  }
  if (speedError < 0) {
    return -Math.min(
      1,
      Math.max(
        0.2,
        Math.abs(speedError) /
          mobileCruiseConfig.responseRangeKilometersPerHour,
      ),
    );
  }
  return Math.min(
    1,
    Math.max(
      0.2,
      target.targetSpeedKilometersPerHour /
        mobileCruiseConfig.maximumTargetSpeedKilometersPerHour +
        speedError / mobileCruiseConfig.responseRangeKilometersPerHour,
    ),
  );
}

export const stoppedMobileCruiseTarget: MobileCruiseTarget = {
  targetSpeedKilometersPerHour: 0,
  selectedGear: 'stopped',
  braking: false,
  reversing: false,
};

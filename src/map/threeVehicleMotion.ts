import { signedHeadingDifference } from './routeHeading';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeElapsedSeconds(elapsedMilliseconds: number): number {
  return clamp(
    Number.isFinite(elapsedMilliseconds) ? elapsedMilliseconds / 1_000 : 0,
    1 / 120,
    0.1,
  );
}

export function vehicleSteeringCueTarget(
  previousHeading: number,
  nextHeading: number,
  speedMetersPerSecond: number,
  elapsedMilliseconds: number,
): number {
  const headingRate =
    signedHeadingDifference(previousHeading, nextHeading) /
    safeElapsedSeconds(elapsedMilliseconds);
  const speedStrength = clamp(Math.abs(speedMetersPerSecond) / 8, 0, 1);
  return clamp(headingRate / 75, -1, 1) * speedStrength;
}

export function vehicleAccelerationCueTarget(
  previousSpeedMetersPerSecond: number,
  nextSpeedMetersPerSecond: number,
  elapsedMilliseconds: number,
): number {
  const acceleration =
    (nextSpeedMetersPerSecond - previousSpeedMetersPerSecond) /
    safeElapsedSeconds(elapsedMilliseconds);
  return clamp(acceleration / 7, -1, 1);
}

export function smoothVehicleMotionCue(
  previous: number,
  target: number,
  elapsedMilliseconds: number,
  responseTimeMilliseconds = 90,
): number {
  const elapsed = clamp(
    Number.isFinite(elapsedMilliseconds) ? elapsedMilliseconds : 0,
    0,
    100,
  );
  const response = Math.max(1, responseTimeMilliseconds);
  return previous + (target - previous) * (1 - Math.exp(-elapsed / response));
}

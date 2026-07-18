import type { CameraFollowZoneConfig } from '../config/followCamera.config';

export interface CameraFollowSpringState {
  offsetXPixels: number;
  offsetYPixels: number;
  initialized: boolean;
}

export interface CameraFollowSpringInput {
  observedOffsetXPixels: number;
  observedOffsetYPixels: number;
  elapsedMilliseconds: number;
  zone: CameraFollowZoneConfig;
  snap?: boolean;
  reducedMotion?: boolean;
}

export interface CameraFollowSpringResult {
  state: CameraFollowSpringState;
  cameraCorrectionXPixels: number;
  cameraCorrectionYPixels: number;
  snapped: boolean;
  insideZone: boolean;
}

export const initialCameraFollowSpringState: CameraFollowSpringState = {
  offsetXPixels: 0,
  offsetYPixels: 0,
  initialized: false,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function advanceCameraFollowSpring(
  previous: CameraFollowSpringState,
  input: CameraFollowSpringInput,
): CameraFollowSpringResult {
  const observedX = finiteOrZero(input.observedOffsetXPixels);
  const observedY = finiteOrZero(input.observedOffsetYPixels);
  const horizontalRadius = Math.max(0, input.zone.horizontalRadiusPixels);
  const verticalRadius = Math.max(0, input.zone.verticalRadiusPixels);
  const snapDistance = Math.max(
    horizontalRadius,
    verticalRadius,
    input.zone.snapDistancePixels,
  );
  const largeDiscontinuity = Math.hypot(observedX, observedY) >= snapDistance;
  const snapped =
    !previous.initialized || Boolean(input.snap) || largeDiscontinuity;

  if (snapped) {
    return {
      state: {
        offsetXPixels: 0,
        offsetYPixels: 0,
        initialized: true,
      },
      cameraCorrectionXPixels: observedX,
      cameraCorrectionYPixels: observedY,
      snapped: true,
      insideZone: true,
    };
  }

  const targetX = clamp(observedX, -horizontalRadius, horizontalRadius);
  const targetY = clamp(observedY, -verticalRadius, verticalRadius);
  const observedInsideZone = targetX === observedX && targetY === observedY;
  if (observedInsideZone) {
    return {
      state: {
        offsetXPixels: observedX,
        offsetYPixels: observedY,
        initialized: true,
      },
      cameraCorrectionXPixels: 0,
      cameraCorrectionYPixels: 0,
      snapped: false,
      insideZone: true,
    };
  }

  const elapsed = clamp(
    finiteOrZero(input.elapsedMilliseconds),
    0,
    Math.max(0, input.zone.maximumElapsedMilliseconds),
  );
  const response = Math.max(1, input.zone.responseTimeMilliseconds);
  const decay = input.reducedMotion ? 0 : Math.exp(-elapsed / response);
  const overflow = Math.max(0, input.zone.maximumOverflowPixels);
  const nextX = clamp(
    targetX + (observedX - targetX) * decay,
    -horizontalRadius - overflow,
    horizontalRadius + overflow,
  );
  const nextY = clamp(
    targetY + (observedY - targetY) * decay,
    -verticalRadius - overflow,
    verticalRadius + overflow,
  );

  return {
    state: {
      offsetXPixels: nextX,
      offsetYPixels: nextY,
      initialized: true,
    },
    cameraCorrectionXPixels: observedX - nextX,
    cameraCorrectionYPixels: observedY - nextY,
    snapped: false,
    insideZone:
      Math.abs(nextX) <= horizontalRadius && Math.abs(nextY) <= verticalRadius,
  };
}

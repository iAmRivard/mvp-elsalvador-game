import { driveJoystickConfig } from '../config/mobileControls.config';
import { applyDeadZone, applyResponseCurve } from './analogInput';

export interface DriveJoystickOutput {
  turn: number;
  verticalIntent: number;
}

export function driveJoystickOutput(
  normalizedX: number,
  normalizedY: number,
): DriveJoystickOutput {
  const turn = applyResponseCurve(
    applyDeadZone(normalizedX, driveJoystickConfig.horizontalDeadZone),
    driveJoystickConfig.steeringExponent,
  );
  const throttle = applyResponseCurve(
    applyDeadZone(-normalizedY, driveJoystickConfig.verticalDeadZone),
    driveJoystickConfig.throttleExponent,
  );
  const verticalIntent =
    Math.abs(throttle) >
    Math.abs(turn) * driveJoystickConfig.verticalIntentDominanceRatio
      ? throttle
      : 0;
  return {
    turn,
    verticalIntent,
  };
}

export function arcadeDriveJoystickOutput(
  normalizedX: number,
  normalizedY: number,
): DriveJoystickOutput {
  return {
    turn: applyResponseCurve(
      applyDeadZone(normalizedX, driveJoystickConfig.horizontalDeadZone),
      driveJoystickConfig.steeringExponent,
    ),
    verticalIntent: applyResponseCurve(
      applyDeadZone(-normalizedY, driveJoystickConfig.verticalDeadZone),
      driveJoystickConfig.throttleExponent,
    ),
  };
}

export function legacyDriveJoystickThrottle(normalizedY: number): number {
  const throttle = applyResponseCurve(
    applyDeadZone(-normalizedY, driveJoystickConfig.verticalDeadZone),
    driveJoystickConfig.throttleExponent,
  );
  return throttle < 0
    ? Math.max(-driveJoystickConfig.reverseMaximum, throttle)
    : throttle;
}

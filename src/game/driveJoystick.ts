import { driveJoystickConfig } from '../config/mobileControls.config';
import { applyDeadZone, applyResponseCurve } from './analogInput';

export interface DriveJoystickOutput {
  throttle: number;
  turn: number;
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
  return {
    turn,
    throttle:
      throttle < 0
        ? Math.max(-driveJoystickConfig.reverseMaximum, throttle)
        : throttle,
  };
}

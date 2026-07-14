export type MobileControlMode =
  | 'single-drive-joystick'
  | 'joystick-auto-throttle'
  | 'joystick-pedals'
  | 'classic-buttons';

export type JoystickPositionMode = 'fixed' | 'floating';
export type JoystickSize = 'small' | 'medium' | 'large';

export interface VirtualJoystickConfig {
  radiusPixels: number;
  knobRadiusPixels: number;
  deadZone: number;
  responseExponent: number;
  returnDurationMilliseconds: number;
  positionMode: JoystickPositionMode;
}

export interface MobileControlsSettings {
  controlMode: MobileControlMode;
  joystickPositionMode: JoystickPositionMode;
  joystickSize: JoystickSize;
  joystickDeadZone: number;
  autoThrottleDefault: boolean;
  hapticsEnabled: boolean;
}

export interface MobileBoostState {
  active: boolean;
  remainingMilliseconds: number;
  cooldownRemainingMilliseconds: number;
}

export const virtualJoystickConfig: VirtualJoystickConfig = {
  radiusPixels: 72,
  knobRadiusPixels: 30,
  deadZone: 0.14,
  responseExponent: 1.45,
  returnDurationMilliseconds: 70,
  positionMode: 'fixed',
};

export const defaultMobileControlsSettings: MobileControlsSettings = {
  controlMode: 'single-drive-joystick',
  joystickPositionMode: 'fixed',
  joystickSize: 'medium',
  joystickDeadZone: 0.12,
  autoThrottleDefault: false,
  hapticsEnabled: true,
};

export const driveJoystickConfig = {
  horizontalDeadZone: 0.12,
  verticalDeadZone: 0.16,
  steeringExponent: 1.4,
  throttleExponent: 1.25,
  reverseMaximum: 0.55,
  brakeThreshold: -0.18,
} as const;

export const mobileBoostConfig = {
  durationMilliseconds: 2_500,
  cooldownMilliseconds: 1_800,
  cancelOnBrake: true,
  cancelOnPause: true,
  cancelOnBlur: true,
} as const;

export const joystickSizeMultipliers: Readonly<Record<JoystickSize, number>> = {
  small: 0.84,
  medium: 1,
  large: 1.16,
};

export const autoThrottleConfig = {
  targetThrottle: 0.72,
  offroadScale: 0.55,
} as const;

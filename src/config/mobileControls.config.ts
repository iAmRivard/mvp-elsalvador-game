export type MobileControlMode =
  'joystick-pedals' | 'joystick-auto-throttle' | 'classic-buttons';

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
  controlMode: 'joystick-auto-throttle',
  joystickPositionMode: 'fixed',
  joystickSize: 'medium',
  joystickDeadZone: virtualJoystickConfig.deadZone,
  autoThrottleDefault: false,
  hapticsEnabled: true,
};

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

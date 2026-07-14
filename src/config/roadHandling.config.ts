import type { RoadClass } from '../types/roads';

export type RoadSurface = RoadClass | 'offroad';
export type RoadAssistMode = 'off' | 'soft' | 'strong';

export interface RoadAssistConfig {
  detectionRadiusMeters: number;
  fullAssistRadiusMeters: number;
  snapStrength: number;
  headingAssistStrength: number;
  disengageDistanceMeters: number;
  edgeSwitchHysteresisMeters: number;
  mobileStrengthMultiplier: number;
}

export const roadAssistConfig: RoadAssistConfig = {
  detectionRadiusMeters: 36,
  fullAssistRadiusMeters: 8,
  snapStrength: 1.1,
  headingAssistStrength: 1.8,
  disengageDistanceMeters: 52,
  edgeSwitchHysteresisMeters: 7,
  mobileStrengthMultiplier: 1.18,
};

export const roadAssistModeMultipliers: Readonly<
  Record<RoadAssistMode, number>
> = {
  off: 0,
  soft: 1,
  strong: 1.65,
};

export const roadSpeedMultipliers: Readonly<Record<RoadSurface, number>> = {
  motorway: 1.25,
  trunk: 1.15,
  primary: 1,
  secondary: 0.9,
  tertiary: 0.8,
  residential: 0.65,
  service: 0.55,
  track: 0.4,
  offroad: 0.25,
};

export const roadFuelMultipliers: Readonly<Record<RoadSurface, number>> = {
  motorway: 1,
  trunk: 1,
  primary: 1,
  secondary: 1.05,
  tertiary: 1.1,
  residential: 1.1,
  service: 1.15,
  track: 1.35,
  offroad: 1.75,
};

export const difficultTerrainSurfaces = new Set<RoadSurface>([
  'track',
  'offroad',
]);

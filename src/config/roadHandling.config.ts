import type { RoadEdge, RoadSurface } from '../types/roads';

export type { RoadSurface } from '../types/roads';
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
  detectionRadiusMeters: 52,
  fullAssistRadiusMeters: 8,
  snapStrength: 1.1,
  headingAssistStrength: 1.8,
  disengageDistanceMeters: 70,
  edgeSwitchHysteresisMeters: 7,
  mobileStrengthMultiplier: 1.18,
};

export const mobileRoadContactConfig = {
  detectionRadiusMeters: 52,
  lastEdgeSearchRadiusMeters: 70,
  gracePeriodMilliseconds: 1_000,
  maximumConsecutiveMisses: 4,
  missSampleIntervalMilliseconds: 250,
  surfaceHistoryLimit: 20,
} as const;

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
  track: 0.5,
  'dirt-road': 0.5,
  'road-unclassified': 0.7,
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
  'dirt-road': 1.35,
  'road-unclassified': 1.15,
  offroad: 1.75,
};

export const roadConditionMultipliers: Readonly<Record<RoadSurface, number>> = {
  motorway: 1,
  trunk: 1,
  primary: 1,
  secondary: 1,
  tertiary: 1,
  residential: 1,
  service: 1,
  track: 1.25,
  'dirt-road': 1.25,
  'road-unclassified': 1.05,
  offroad: 1.75,
};

export const roadSurfaceLabels: Readonly<Record<RoadSurface, string>> = {
  motorway: 'Autopista',
  trunk: 'Carretera troncal',
  primary: 'Vía primaria',
  secondary: 'Vía secundaria',
  tertiary: 'Vía terciaria',
  residential: 'Calle residencial',
  service: 'Vía de servicio',
  track: 'Camino de tierra',
  'dirt-road': 'Camino de tierra',
  'road-unclassified': 'Vía sin clasificar',
  offroad: 'Fuera de carretera',
};

export function roadSurfaceForEdge(edge: RoadEdge): RoadSurface {
  return (
    edge.surface ?? (edge.roadClass === 'track' ? 'dirt-road' : edge.roadClass)
  );
}

export const difficultTerrainSurfaces = new Set<RoadSurface>([
  'track',
  'dirt-road',
  'offroad',
]);

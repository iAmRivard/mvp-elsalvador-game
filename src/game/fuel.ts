import {
  roadFuelMultipliers,
  type RoadSurface,
} from '../config/roadHandling.config';
import { fuelConsumptionConfig } from '../config/travel.config';

export interface RouteFuelProfile {
  fuelMultiplier: number;
  boostShare?: number;
  offroadShare?: number;
}

export type FuelSufficiency = 'sufficient' | 'tight' | 'insufficient';

function clampedShare(value: number | undefined): number {
  return Math.max(0, Math.min(1, value ?? 0));
}

export function fuelConsumedForGeographicDistance(
  geographicDistanceMeters: number,
  profile: RouteFuelProfile = { fuelMultiplier: 1 },
): number {
  const boostShare = clampedShare(profile.boostShare);
  const offroadShare = clampedShare(profile.offroadShare);
  const boostMultiplier =
    1 + boostShare * (fuelConsumptionConfig.boostMultiplier - 1);
  const surfaceMultiplier =
    1 + offroadShare * (roadFuelMultipliers.offroad - 1);
  return (
    Math.max(0, geographicDistanceMeters) *
    fuelConsumptionConfig.percentPerGeographicMeter *
    Math.max(0.1, profile.fuelMultiplier) *
    boostMultiplier *
    surfaceMultiplier
  );
}

export function estimateFuelRange(
  fuelPercent: number,
  currentSurface: RoadSurface,
): number {
  const consumptionPerMeter =
    fuelConsumptionConfig.percentPerGeographicMeter *
    roadFuelMultipliers[currentSurface];
  return Math.max(0, fuelPercent) / Math.max(0.000_001, consumptionPerMeter);
}

export function estimateFuelAtDestination(
  routeDistanceMeters: number,
  fuelPercent: number,
  routeProfile: RouteFuelProfile,
): number {
  return Math.max(
    0,
    fuelPercent -
      fuelConsumedForGeographicDistance(routeDistanceMeters, routeProfile),
  );
}

export function fuelSufficiency(
  fuelAtDestinationPercent: number,
): FuelSufficiency {
  if (fuelAtDestinationPercent <= 0) return 'insufficient';
  if (fuelAtDestinationPercent < 10) return 'tight';
  return 'sufficient';
}

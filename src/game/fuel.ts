import {
  roadFuelMultipliers,
  type RoadSurface,
} from '../config/roadHandling.config';
import {
  fuelConsumptionConfig,
  type FuelConsumptionConfig,
  vehicleHandlingConfig,
} from '../config/travel.config';

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
  consumption: FuelConsumptionConfig = fuelConsumptionConfig,
  offroadFuelMultiplier = vehicleHandlingConfig.offroadFuelMultiplier,
): number {
  const boostShare = clampedShare(profile.boostShare);
  const offroadShare = clampedShare(profile.offroadShare);
  const boostMultiplier = 1 + boostShare * (consumption.boostMultiplier - 1);
  const surfaceMultiplier = 1 + offroadShare * (offroadFuelMultiplier - 1);
  return (
    Math.max(0, geographicDistanceMeters) *
    consumption.percentPerGeographicMeter *
    Math.max(0.1, profile.fuelMultiplier) *
    boostMultiplier *
    surfaceMultiplier
  );
}

export function estimateFuelRange(
  fuelPercent: number,
  currentSurface: RoadSurface,
  consumption: FuelConsumptionConfig = fuelConsumptionConfig,
  offroadFuelMultiplier = vehicleHandlingConfig.offroadFuelMultiplier,
): number {
  const vehicleTerrainMultiplier =
    currentSurface === 'offroad' ||
    currentSurface === 'track' ||
    currentSurface === 'dirt-road'
      ? roadFuelMultipliers[currentSurface] *
        (offroadFuelMultiplier / vehicleHandlingConfig.offroadFuelMultiplier)
      : roadFuelMultipliers[currentSurface];
  const consumptionPerMeter =
    consumption.percentPerGeographicMeter * vehicleTerrainMultiplier;
  return Math.max(0, fuelPercent) / Math.max(0.000_001, consumptionPerMeter);
}

export function estimateFuelAtDestination(
  routeDistanceMeters: number,
  fuelPercent: number,
  routeProfile: RouteFuelProfile,
  consumption: FuelConsumptionConfig = fuelConsumptionConfig,
  offroadFuelMultiplier = vehicleHandlingConfig.offroadFuelMultiplier,
): number {
  return Math.max(
    0,
    fuelPercent -
      fuelConsumedForGeographicDistance(
        routeDistanceMeters,
        routeProfile,
        consumption,
        offroadFuelMultiplier,
      ),
  );
}

export function fuelSufficiency(
  fuelAtDestinationPercent: number,
): FuelSufficiency {
  if (fuelAtDestinationPercent <= 0) return 'insufficient';
  if (fuelAtDestinationPercent < 10) return 'tight';
  return 'sufficient';
}

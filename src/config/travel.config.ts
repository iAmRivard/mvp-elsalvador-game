export interface TravelConfig {
  normalMaximumSpeedMetersPerSecond: number;
  boostMaximumSpeedMetersPerSecond: number;
  geographicTravelScale: number;
  accelerationMetersPerSecondSquared: number;
  brakingMetersPerSecondSquared: number;
  coastDecelerationMetersPerSecondSquared: number;
}

export interface VehicleHandlingConfig {
  maximumForwardSpeed: number;
  maximumBoostSpeed: number;
  maximumReverseSpeed: number;
  acceleration: number;
  braking: number;
  coastDeceleration: number;
  baseTurnRate: number;
  minimumSteeringSpeed: number;
  maximumSpeedTurnMultiplier: number;
  offroadSpeedMultiplier: number;
  offroadFuelMultiplier: number;
}

export interface FuelConsumptionConfig {
  percentPerGeographicMeter: number;
  boostMultiplier: number;
}

export type SteeringSensitivity = 'low' | 'medium' | 'high';

export const travelConfig: TravelConfig = {
  normalMaximumSpeedMetersPerSecond: 26,
  boostMaximumSpeedMetersPerSecond: 38,
  geographicTravelScale: 5,
  accelerationMetersPerSecondSquared: 9,
  brakingMetersPerSecondSquared: 14,
  coastDecelerationMetersPerSecondSquared: 5,
};

export const vehicleHandlingConfig: VehicleHandlingConfig = {
  maximumForwardSpeed: travelConfig.normalMaximumSpeedMetersPerSecond,
  maximumBoostSpeed: travelConfig.boostMaximumSpeedMetersPerSecond,
  maximumReverseSpeed: 8,
  acceleration: travelConfig.accelerationMetersPerSecondSquared,
  braking: travelConfig.brakingMetersPerSecondSquared,
  coastDeceleration: travelConfig.coastDecelerationMetersPerSecondSquared,
  baseTurnRate: 90,
  minimumSteeringSpeed: 2.2,
  maximumSpeedTurnMultiplier: 0.48,
  offroadSpeedMultiplier: 0.6,
  offroadFuelMultiplier: 1.75,
};

export const fuelConsumptionConfig: FuelConsumptionConfig = {
  percentPerGeographicMeter: 0.0009,
  boostMultiplier: 1.35,
};

export const steeringSensitivityMultipliers: Readonly<
  Record<SteeringSensitivity, number>
> = {
  low: 0.78,
  medium: 1,
  high: 1.22,
};

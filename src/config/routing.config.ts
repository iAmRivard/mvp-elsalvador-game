export const routingConfig = {
  maximumSnapDistanceMeters: 2_000,
  routeDeviationDistanceMeters: 250,
  deviationCheckIntervalMilliseconds: 1_000,
  automaticRecalculationCooldownMilliseconds: 5_000,
  maximumCacheEntries: 32,
  averageCruisingSpeedRatio: 0.72,
} as const;

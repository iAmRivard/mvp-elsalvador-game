export const routingConfig = {
  maximumSnapDistanceMeters: 2_000,
  routeDeviationDistanceMeters: 250,
  routeRejoinDistanceMeters: 24,
  headingAlignmentThresholdDegrees: 18,
  tutorialRouteHeadingToleranceDegrees: 45,
  stoppedGuidanceSpeedKilometersPerHour: 2,
  stoppedGuidanceHeadingDifferenceDegrees: 45,
  deviationCheckIntervalMilliseconds: 1_000,
  automaticRecalculationCooldownMilliseconds: 5_000,
  maximumCacheEntries: 32,
  workerTimeoutMilliseconds: 4_000,
  averageCruisingSpeedRatio: 0.72,
} as const;

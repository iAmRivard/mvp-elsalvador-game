export const vehicleStateConfig = {
  maximumCondition: 100,
  initialCondition: 100,
  initialMaximumFuel: 100,
  offroadConditionPerVehicleMeter: 0.05,
  trackConditionPerVehicleMeter: 0.012,
  blockedImpactCondition: 1.5,
  blockedImpactCooldownMilliseconds: 1_200,
} as const;

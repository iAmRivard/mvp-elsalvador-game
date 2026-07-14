export const vehicleStateConfig = {
  maximumCondition: 100,
  initialCondition: 100,
  initialMaximumFuel: 100,
  offroadConditionPerVehicleMeter: 0.025,
  trackConditionPerVehicleMeter: 0.008,
  blockedImpactCondition: 1.5,
  blockedImpactCooldownMilliseconds: 1_200,
  emergencyRecoveryCondition: 35,
  emergencyRecoveryFuel: 20,
} as const;

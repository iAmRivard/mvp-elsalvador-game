export interface MovementSubstepConfig {
  maximumGeographicStepMeters: number;
  maximumSubstepsPerFrame: number;
  maximumDeltaTimeSeconds: number;
}

export const movementSubstepConfig: MovementSubstepConfig = {
  maximumGeographicStepMeters: 10,
  maximumSubstepsPerFrame: 12,
  maximumDeltaTimeSeconds: 0.25,
};

export function calculateMovementSubsteps(
  geographicDistanceMeters: number,
  config: MovementSubstepConfig = movementSubstepConfig,
): number {
  const safeDistance = Number.isFinite(geographicDistanceMeters)
    ? Math.max(0, geographicDistanceMeters)
    : 0;
  const maximumStep =
    Number.isFinite(config.maximumGeographicStepMeters) &&
    config.maximumGeographicStepMeters > 0
      ? config.maximumGeographicStepMeters
      : movementSubstepConfig.maximumGeographicStepMeters;
  const maximumSubsteps =
    Number.isFinite(config.maximumSubstepsPerFrame) &&
    config.maximumSubstepsPerFrame >= 1
      ? Math.floor(config.maximumSubstepsPerFrame)
      : movementSubstepConfig.maximumSubstepsPerFrame;

  return Math.min(
    maximumSubsteps,
    Math.max(1, Math.ceil(safeDistance / maximumStep)),
  );
}

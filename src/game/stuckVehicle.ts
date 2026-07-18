import type { RestrictedAreaType } from '../types/restrictedAreas';

export interface StuckVehicleObservation {
  gameActive: boolean;
  simulationEnabled: boolean;
  blockingOverlay: boolean;
  fuel: number;
  condition: number;
  speedKilometersPerHour: number;
  targetSpeedKilometersPerHour: number;
  forwardIntent: boolean;
  stationaryMilliseconds: number;
  movementBlockedBy: RestrictedAreaType | null;
}

export interface StuckVehicleHelp {
  visible: boolean;
  cause: RestrictedAreaType | null;
  canRetryAcceleration: boolean;
}

export const stuckVehicleConfig = {
  maximumStoppedSpeedKilometersPerHour: 1,
  minimumTargetSpeedKilometersPerHour: 10,
  stationaryDelayMilliseconds: 1_750,
} as const;

export function stuckVehicleHelpFor(
  observation: StuckVehicleObservation,
): StuckVehicleHelp {
  const hasForwardRequest =
    observation.forwardIntent ||
    observation.targetSpeedKilometersPerHour >
      stuckVehicleConfig.minimumTargetSpeedKilometersPerHour;
  const visible = Boolean(
    observation.gameActive &&
      observation.simulationEnabled &&
      !observation.blockingOverlay &&
      observation.fuel > 0 &&
      observation.condition > 0 &&
      Math.abs(observation.speedKilometersPerHour) <
        stuckVehicleConfig.maximumStoppedSpeedKilometersPerHour &&
      hasForwardRequest &&
      observation.stationaryMilliseconds >=
        stuckVehicleConfig.stationaryDelayMilliseconds,
  );
  return {
    visible,
    cause: visible ? observation.movementBlockedBy : null,
    canRetryAcceleration: visible && observation.movementBlockedBy === null,
  };
}

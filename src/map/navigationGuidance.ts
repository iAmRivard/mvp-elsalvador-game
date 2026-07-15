import { routingConfig } from '../config/routing.config';
import type {
  ActiveNavigationState,
  VehicleOrientation,
} from '../types/navigation';
import { normalizeHeading, signedHeadingDifference } from './routeHeading';

export function vehicleOrientation(
  physicalHeading: number,
  recommendedHeading: number | null,
): VehicleOrientation {
  return {
    physicalHeading: normalizeHeading(physicalHeading),
    recommendedHeading:
      recommendedHeading === null ? null : normalizeHeading(recommendedHeading),
    headingDifference:
      recommendedHeading === null
        ? null
        : signedHeadingDifference(physicalHeading, recommendedHeading),
  };
}

function turnDirection(difference: number): 'izquierda' | 'derecha' {
  return difference < 0 ? 'izquierda' : 'derecha';
}

export function vehicleIsReversing(speedMetersPerSecond: number): boolean {
  return speedMetersPerSecond < -0.14;
}

export function navigationGuidanceMessage(
  navigation: ActiveNavigationState | null,
  orientation: VehicleOrientation,
  speedKilometersPerHour: number,
  roadDistanceMeters: number | null,
  reversing: boolean,
): string | null {
  const difference = orientation.headingDifference;
  if (!navigation || difference === null || reversing) return null;
  if (navigation.requiresRejoin) {
    if (Math.abs(difference) < 22) return 'Reincorpórate a la ruta';
    return `Gira a la ${turnDirection(difference)} para volver al camino`;
  }
  const stopped =
    Math.abs(speedKilometersPerHour) <
    routingConfig.stoppedGuidanceSpeedKilometersPerHour;
  const nearRoad =
    roadDistanceMeters !== null &&
    roadDistanceMeters <= routingConfig.routeRejoinDistanceMeters * 2.2;
  if (
    stopped &&
    nearRoad &&
    Math.abs(difference) >=
      routingConfig.stoppedGuidanceHeadingDifferenceDegrees
  ) {
    return `Gira el vehículo hacia la ${turnDirection(difference)} para seguir la ruta`;
  }
  return null;
}

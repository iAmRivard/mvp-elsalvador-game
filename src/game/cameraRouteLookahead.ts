import { routeBearing, signedHeadingDifference } from '../map/routeHeading';
import type {
  ActiveNavigationState,
  RouteNavigationInstruction,
} from '../types/navigation';
import type { RoadCoordinates } from '../types/roads';

export interface CameraRouteLookaheadInput {
  playerCoordinates: RoadCoordinates;
  playerHeading: number;
  speedKilometersPerHour: number;
  activeNavigation: ActiveNavigationState | null;
  nextInstruction: RouteNavigationInstruction | null;
  distanceToNextInstructionMeters: number | null;
  contextScale?: number;
  reducedMotion?: boolean;
}

export interface CameraRouteLookaheadResult {
  offsetXPixels: number;
  offsetYPixels: number;
  strength: number;
  lookaheadMeters: number;
  targetHeading: number | null;
  anticipatesTurn: boolean;
}

const START_SPEED_KILOMETERS_PER_HOUR = 3.5;
const FULL_ACTIVATION_SPEED_KILOMETERS_PER_HOUR = 12;
const RELEVANT_TURN_DISTANCE_METERS = 450;
const MAXIMUM_LOOKAHEAD_PIXELS = 14;
const REDUCED_MOTION_MAXIMUM_PIXELS = 8;

const zeroLookahead: CameraRouteLookaheadResult = {
  offsetXPixels: 0,
  offsetYPixels: 0,
  strength: 0,
  lookaheadMeters: 0,
  targetHeading: null,
  anticipatesTurn: false,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function routeLookaheadMetersForSpeed(
  speedKilometersPerHour: number,
): number {
  const speed = Math.max(
    0,
    Number.isFinite(speedKilometersPerHour) ? speedKilometersPerHour : 0,
  );
  if (speed <= 30) return 10 + (speed / 30) * 5;
  if (speed <= 60) return 15 + ((speed - 30) / 30) * 15;
  if (speed <= 90) return 30 + ((speed - 60) / 30) * 15;
  return Math.min(55, 45 + ((speed - 90) / 30) * 10);
}

function isRelevantTurn(
  instruction: RouteNavigationInstruction | null,
): boolean {
  return Boolean(
    instruction &&
    instruction.type !== 'continue' &&
    instruction.type !== 'arrive',
  );
}

export function cameraRouteLookahead(
  input: CameraRouteLookaheadInput,
): CameraRouteLookaheadResult {
  const speed = Number.isFinite(input.speedKilometersPerHour)
    ? input.speedKilometersPerHour
    : 0;
  if (speed <= START_SPEED_KILOMETERS_PER_HOUR) {
    return zeroLookahead;
  }

  const activation = clamp01(
    (speed - START_SPEED_KILOMETERS_PER_HOUR) /
      (FULL_ACTIVATION_SPEED_KILOMETERS_PER_HOUR -
        START_SPEED_KILOMETERS_PER_HOUR),
  );
  const instructionDistance = input.distanceToNextInstructionMeters;
  const anticipatesTurn =
    isRelevantTurn(input.nextInstruction) &&
    instructionDistance !== null &&
    Number.isFinite(instructionDistance) &&
    instructionDistance >= 0 &&
    instructionDistance <= RELEVANT_TURN_DISTANCE_METERS;
  const turnProximity = anticipatesTurn
    ? 1 - clamp01(instructionDistance / RELEVANT_TURN_DISTANCE_METERS)
    : 0;
  const turnStrength = anticipatesTurn ? 0.65 + turnProximity * 0.35 : 1;
  const contextScale = clamp01(input.contextScale ?? 1);
  const lookaheadMeters =
    routeLookaheadMetersForSpeed(speed) * activation * contextScale;
  const strength = clamp01((lookaheadMeters / 55) * turnStrength);
  const targetHeading = anticipatesTurn
    ? routeBearing(input.playerCoordinates, input.nextInstruction!.coordinates)
    : (input.activeNavigation?.recommendedHeading ?? input.playerHeading);
  const differenceRadians =
    (signedHeadingDifference(input.playerHeading, targetHeading) * Math.PI) /
    180;
  const maximumPixels = input.reducedMotion
    ? REDUCED_MOTION_MAXIMUM_PIXELS
    : MAXIMUM_LOOKAHEAD_PIXELS;
  const magnitude = maximumPixels * strength;

  // El vehículo se coloca en sentido contrario al tramo que queremos revelar.
  return {
    offsetXPixels: -Math.sin(differenceRadians) * magnitude,
    offsetYPixels: Math.cos(differenceRadians) * magnitude,
    strength,
    lookaheadMeters,
    targetHeading,
    anticipatesTurn,
  };
}

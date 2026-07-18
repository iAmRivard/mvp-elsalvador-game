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
  reducedMotion?: boolean;
}

export interface CameraRouteLookaheadResult {
  offsetXPixels: number;
  offsetYPixels: number;
  strength: number;
  targetHeading: number | null;
  anticipatesTurn: boolean;
}

const START_SPEED_KILOMETERS_PER_HOUR = 8;
const FULL_SPEED_KILOMETERS_PER_HOUR = 48;
const RELEVANT_TURN_DISTANCE_METERS = 450;
const MAXIMUM_LOOKAHEAD_PIXELS = 14;
const REDUCED_MOTION_MAXIMUM_PIXELS = 8;

const zeroLookahead: CameraRouteLookaheadResult = {
  offsetXPixels: 0,
  offsetYPixels: 0,
  strength: 0,
  targetHeading: null,
  anticipatesTurn: false,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
  const navigation = input.activeNavigation;
  const speed = Number.isFinite(input.speedKilometersPerHour)
    ? input.speedKilometersPerHour
    : 0;
  if (!navigation || speed <= START_SPEED_KILOMETERS_PER_HOUR) {
    return zeroLookahead;
  }

  const speedStrength = clamp01(
    (speed - START_SPEED_KILOMETERS_PER_HOUR) /
      (FULL_SPEED_KILOMETERS_PER_HOUR - START_SPEED_KILOMETERS_PER_HOUR),
  );
  const instructionDistance = input.distanceToNextInstructionMeters;
  const anticipatesTurn =
    isRelevantTurn(input.nextInstruction) &&
    instructionDistance !== null &&
    Number.isFinite(instructionDistance) &&
    instructionDistance >= 0 &&
    instructionDistance <= RELEVANT_TURN_DISTANCE_METERS;
  const turnProximity = anticipatesTurn
    ? 1 - clamp01(instructionDistance! / RELEVANT_TURN_DISTANCE_METERS)
    : 0;
  const navigationStrength = anticipatesTurn
    ? 0.45 + turnProximity * 0.55
    : 0.28;
  const strength = speedStrength * navigationStrength;
  const targetHeading = anticipatesTurn
    ? routeBearing(input.playerCoordinates, input.nextInstruction!.coordinates)
    : navigation.recommendedHeading;
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
    targetHeading,
    anticipatesTurn,
  };
}

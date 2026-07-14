import { routingConfig } from '../config/routing.config';
import { distanceBetweenMeters } from '../game/discovery';
import type {
  NavigationInstructionType,
  RouteNavigationInstruction,
} from '../types/navigation';
import type { RoadCoordinates } from '../types/roads';

const MANEUVER_LOOK_DISTANCE_METERS = 35;
const MINIMUM_TURN_ANGLE_DEGREES = 22;
const MINIMUM_MANEUVER_SPACING_METERS = 90;

interface RouteProjection {
  coordinates: RoadCoordinates;
  distanceMeters: number;
  distanceFromRouteStartMeters: number;
  segmentIndex: number;
}

export interface NavigationProgress {
  nextInstruction: RouteNavigationInstruction | null;
  distanceToNextInstructionMeters: number | null;
  distanceFromRouteStartMeters: number;
  distanceToRouteMeters: number;
  offRoute: boolean;
  immediateCoordinates: RoadCoordinates[];
}

function normalizeSignedAngle(value: number): number {
  return ((value + 540) % 360) - 180;
}

function bearing(start: RoadCoordinates, end: RoadCoordinates): number {
  const latitude = ((start[1] + end[1]) / 2) * (Math.PI / 180);
  const east = (end[0] - start[0]) * Math.cos(latitude);
  const north = end[1] - start[1];
  return (Math.atan2(east, north) * 180) / Math.PI;
}

function cumulativeDistances(route: readonly RoadCoordinates[]): number[] {
  const distances = [0];
  for (let index = 1; index < route.length; index += 1) {
    distances.push(
      distances[index - 1] +
        distanceBetweenMeters(route[index - 1], route[index]),
    );
  }
  return distances;
}

function anchorBefore(index: number, distances: readonly number[]): number {
  let anchor = index - 1;
  while (
    anchor > 0 &&
    distances[index] - distances[anchor] < MANEUVER_LOOK_DISTANCE_METERS
  ) {
    anchor -= 1;
  }
  return anchor;
}

function anchorAfter(index: number, distances: readonly number[]): number {
  let anchor = index + 1;
  while (
    anchor < distances.length - 1 &&
    distances[anchor] - distances[index] < MANEUVER_LOOK_DISTANCE_METERS
  ) {
    anchor += 1;
  }
  return anchor;
}

function instructionTypeForTurn(
  headingChange: number,
): NavigationInstructionType | null {
  const magnitude = Math.abs(headingChange);
  if (magnitude < MINIMUM_TURN_ANGLE_DEGREES) return null;
  if (magnitude >= 145) return 'u-turn';
  if (magnitude < 48) {
    return headingChange > 0 ? 'slight-right' : 'slight-left';
  }
  return headingChange > 0 ? 'turn-right' : 'turn-left';
}

function instructionText(type: NavigationInstructionType): string {
  switch (type) {
    case 'continue':
      return 'Continúa recto';
    case 'turn-left':
      return 'Gira a la izquierda';
    case 'turn-right':
      return 'Gira a la derecha';
    case 'slight-left':
      return 'Mantente ligeramente a la izquierda';
    case 'slight-right':
      return 'Mantente ligeramente a la derecha';
    case 'u-turn':
      return 'Da la vuelta cuando sea seguro';
    case 'arrive':
      return 'Has llegado al objetivo';
  }
}

function maneuverStrength(type: NavigationInstructionType): number {
  if (type === 'u-turn') return 3;
  if (type === 'turn-left' || type === 'turn-right') return 2;
  if (type === 'slight-left' || type === 'slight-right') return 1;
  return 0;
}

export function generateNavigationInstructions(
  route: readonly RoadCoordinates[],
): RouteNavigationInstruction[] {
  if (route.length < 2) return [];
  const distances = cumulativeDistances(route);
  const maneuvers: RouteNavigationInstruction[] = [];

  for (let index = 1; index < route.length - 1; index += 1) {
    const before = anchorBefore(index, distances);
    const after = anchorAfter(index, distances);
    if (before === index || after === index) continue;
    const headingChange = normalizeSignedAngle(
      bearing(route[index], route[after]) -
        bearing(route[before], route[index]),
    );
    const type = instructionTypeForTurn(headingChange);
    if (!type) continue;
    const instruction: RouteNavigationInstruction = {
      type,
      coordinates: route[index],
      distanceFromPreviousMeters: 0,
      distanceFromRouteStartMeters: distances[index],
      routeCoordinateIndex: index,
      text: instructionText(type),
    };
    const previous = maneuvers.at(-1);
    if (
      previous &&
      instruction.distanceFromRouteStartMeters -
        previous.distanceFromRouteStartMeters <
        MINIMUM_MANEUVER_SPACING_METERS
    ) {
      if (maneuverStrength(type) > maneuverStrength(previous.type)) {
        maneuvers[maneuvers.length - 1] = instruction;
      }
      continue;
    }
    maneuvers.push(instruction);
  }

  const totalDistance = distances.at(-1) ?? 0;
  const firstManeuverDistance =
    maneuvers[0]?.distanceFromRouteStartMeters ?? totalDistance;
  const instructions: RouteNavigationInstruction[] = [
    {
      type: 'continue',
      coordinates: route[0],
      distanceFromPreviousMeters: firstManeuverDistance,
      distanceFromRouteStartMeters: 0,
      routeCoordinateIndex: 0,
      text: instructionText('continue'),
    },
  ];
  let previousDistance = 0;
  for (const maneuver of maneuvers) {
    maneuver.distanceFromPreviousMeters =
      maneuver.distanceFromRouteStartMeters - previousDistance;
    previousDistance = maneuver.distanceFromRouteStartMeters;
    instructions.push(maneuver);
  }
  instructions.push({
    type: 'arrive',
    coordinates: route.at(-1) ?? route[0],
    distanceFromPreviousMeters: totalDistance - previousDistance,
    distanceFromRouteStartMeters: totalDistance,
    routeCoordinateIndex: route.length - 1,
    text: instructionText('arrive'),
  });
  return instructions;
}

function projectOntoSegment(
  point: RoadCoordinates,
  start: RoadCoordinates,
  end: RoadCoordinates,
): { coordinates: RoadCoordinates; distanceMeters: number; progress: number } {
  const longitudeScale = 111_320 * Math.cos((point[1] * Math.PI) / 180);
  const latitudeScale = 111_132;
  const startX = (start[0] - point[0]) * longitudeScale;
  const startY = (start[1] - point[1]) * latitudeScale;
  const endX = (end[0] - point[0]) * longitudeScale;
  const endY = (end[1] - point[1]) * latitudeScale;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const progress =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared),
        );
  return {
    coordinates: [
      start[0] + (end[0] - start[0]) * progress,
      start[1] + (end[1] - start[1]) * progress,
    ],
    distanceMeters: Math.hypot(
      startX + deltaX * progress,
      startY + deltaY * progress,
    ),
    progress,
  };
}

export function projectPositionOntoRoute(
  point: RoadCoordinates,
  route: readonly RoadCoordinates[],
): RouteProjection | null {
  if (route.length < 2) return null;
  let nearest: RouteProjection | null = null;
  let distanceBeforeSegment = 0;
  for (let index = 1; index < route.length; index += 1) {
    const segmentDistance = distanceBetweenMeters(
      route[index - 1],
      route[index],
    );
    const projection = projectOntoSegment(
      point,
      route[index - 1],
      route[index],
    );
    if (!nearest || projection.distanceMeters < nearest.distanceMeters) {
      nearest = {
        coordinates: projection.coordinates,
        distanceMeters: projection.distanceMeters,
        distanceFromRouteStartMeters:
          distanceBeforeSegment + projection.progress * segmentDistance,
        segmentIndex: index - 1,
      };
    }
    distanceBeforeSegment += segmentDistance;
  }
  return nearest;
}

export function navigationProgress(
  point: RoadCoordinates,
  route: readonly RoadCoordinates[],
  instructions: readonly RouteNavigationInstruction[],
): NavigationProgress {
  const projection = projectPositionOntoRoute(point, route);
  if (!projection) {
    return {
      nextInstruction: null,
      distanceToNextInstructionMeters: null,
      distanceFromRouteStartMeters: 0,
      distanceToRouteMeters: Number.POSITIVE_INFINITY,
      offRoute: true,
      immediateCoordinates: [],
    };
  }
  const initialContinue =
    projection.distanceFromRouteStartMeters < 25 &&
    instructions[0]?.type === 'continue'
      ? instructions[0]
      : null;
  const nextInstruction =
    initialContinue ??
    instructions.find(
      (instruction) =>
        instruction.type !== 'continue' &&
        instruction.distanceFromRouteStartMeters >
          projection.distanceFromRouteStartMeters + 15,
    ) ??
    instructions.at(-1) ??
    null;
  const distanceToNextInstructionMeters = nextInstruction
    ? nextInstruction.type === 'continue'
      ? nextInstruction.distanceFromPreviousMeters
      : Math.max(
          0,
          nextInstruction.distanceFromRouteStartMeters -
            projection.distanceFromRouteStartMeters,
        )
    : null;
  const immediateEndIndex = Math.max(
    projection.segmentIndex + 1,
    nextInstruction?.routeCoordinateIndex ?? projection.segmentIndex + 1,
  );
  return {
    nextInstruction,
    distanceToNextInstructionMeters,
    distanceFromRouteStartMeters: projection.distanceFromRouteStartMeters,
    distanceToRouteMeters: projection.distanceMeters,
    offRoute:
      projection.distanceMeters > routingConfig.routeDeviationDistanceMeters,
    immediateCoordinates: [
      projection.coordinates,
      ...route.slice(projection.segmentIndex + 1, immediateEndIndex + 1),
    ],
  };
}

export function formatNavigationInstruction(
  instruction: RouteNavigationInstruction,
  distanceMeters: number,
): string {
  const distance =
    distanceMeters < 1_000
      ? `${Math.max(0, Math.round(distanceMeters))} m`
      : `${(distanceMeters / 1_000).toFixed(1)} km`;
  if (instruction.type === 'continue') {
    return `Continúa recto por ${distance}`;
  }
  if (instruction.type === 'arrive') {
    return distanceMeters <= 20 ? instruction.text : `Destino en ${distance}`;
  }
  return `En ${distance}, ${instruction.text.toLocaleLowerCase('es-SV')}`;
}

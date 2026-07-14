import type { PlayerInput, PlayerRuntime } from '../types/game';
import {
  roadAssistConfig,
  roadAssistModeMultipliers,
  roadFuelMultipliers,
  roadSpeedMultipliers,
  type RoadAssistMode,
  type RoadSurface,
} from '../config/roadHandling.config';
import {
  fuelConsumptionConfig,
  steeringSensitivityMultipliers,
  travelConfig,
  vehicleHandlingConfig,
  type FuelConsumptionConfig,
  type SteeringSensitivity,
  type TravelConfig,
  type VehicleHandlingConfig,
} from '../config/travel.config';
import {
  projectPositionOntoRoad,
  roadResultForEdge,
} from '../roads/spatialIndex';
import type { RestrictedAreaType } from '../types/restrictedAreas';
import type { RoadContact, RoadCoordinates } from '../types/roads';

const EARTH_RADIUS_METERS = 6_371_008.8;
const MAXIMUM_DELTA_TIME_SECONDS = 0.05;

export const EL_SALVADOR_MOVEMENT_BOUNDS = {
  west: -90.2,
  south: 13,
  east: -87.65,
  north: 14.55,
} as const;

export interface MovePlayerInput {
  longitude: number;
  latitude: number;
  heading: number;
  speedMetersPerSecond: number;
  deltaTimeSeconds: number;
  geographicTravelScale: number;
}

export interface MovePlayerResult {
  longitude: number;
  latitude: number;
  heading: number;
  vehicleDistanceMeters: number;
  geographicDistanceMeters: number;
}

export interface StepPlayerOptions {
  travel?: TravelConfig;
  handling?: VehicleHandlingConfig;
  fuel?: FuelConsumptionConfig;
  steeringSensitivity?: SteeringSensitivity;
  roadNetworkEnabled?: boolean;
  roadContact?: RoadContact | null;
  roadAssistMode?: RoadAssistMode;
  roadAssistStrengthMultiplier?: number;
  restrictedAreaTypeAt?: (
    position: RoadCoordinates,
  ) => RestrictedAreaType | null;
  driveEnabled?: boolean;
}

export interface PlayerStepEnvironment {
  surface: RoadSurface;
  speedMultiplier: number;
  fuelMultiplier: number;
  roadDistanceMeters: number | null;
  movementBlockedBy: RestrictedAreaType | null;
}

export interface PlayerStepResult {
  player: PlayerRuntime;
  environment: PlayerStepEnvironment;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function movePlayer(input: MovePlayerInput): MovePlayerResult {
  const deltaTime = Math.max(0, input.deltaTimeSeconds);
  const scale = Math.max(0, input.geographicTravelScale);
  const vehicleDistanceMeters = Math.abs(
    input.speedMetersPerSecond * deltaTime,
  );
  const geographicDistance = input.speedMetersPerSecond * deltaTime * scale;
  const heading = normalizeHeading(input.heading);

  if (geographicDistance === 0) {
    return {
      longitude: input.longitude,
      latitude: input.latitude,
      heading,
      vehicleDistanceMeters: 0,
      geographicDistanceMeters: 0,
    };
  }

  const angularDistance = geographicDistance / EARTH_RADIUS_METERS;
  const bearing = degreesToRadians(heading);
  const latitude = degreesToRadians(input.latitude);
  const longitude = degreesToRadians(input.longitude);
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const destinationLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) -
        Math.sin(latitude) * Math.sin(destinationLatitude),
    );

  return {
    longitude: radiansToDegrees(destinationLongitude),
    latitude: radiansToDegrees(destinationLatitude),
    heading,
    vehicleDistanceMeters,
    geographicDistanceMeters: Math.abs(geographicDistance),
  };
}

function approach(
  current: number,
  target: number,
  maximumChange: number,
): number {
  if (current < target) return Math.min(current + maximumChange, target);
  if (current > target) return Math.max(current - maximumChange, target);
  return current;
}

function constrainToBounds(longitude: number, latitude: number) {
  return {
    longitude: Math.min(
      EL_SALVADOR_MOVEMENT_BOUNDS.east,
      Math.max(EL_SALVADOR_MOVEMENT_BOUNDS.west, longitude),
    ),
    latitude: Math.min(
      EL_SALVADOR_MOVEMENT_BOUNDS.north,
      Math.max(EL_SALVADOR_MOVEMENT_BOUNDS.south, latitude),
    ),
  };
}

function shortestHeadingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function nearestBidirectionalHeading(
  playerHeading: number,
  roadHeading: number,
): number {
  const forward = normalizeHeading(roadHeading);
  const reverse = normalizeHeading(roadHeading + 180);
  return Math.abs(shortestHeadingDelta(playerHeading, forward)) <=
    Math.abs(shortestHeadingDelta(playerHeading, reverse))
    ? forward
    : reverse;
}

function roadInfluence(distanceMeters: number): number {
  if (distanceMeters <= roadAssistConfig.fullAssistRadiusMeters) return 1;
  return Math.max(
    0,
    1 -
      (distanceMeters - roadAssistConfig.fullAssistRadiusMeters) /
        (roadAssistConfig.detectionRadiusMeters -
          roadAssistConfig.fullAssistRadiusMeters),
  );
}

function roadState(
  player: PlayerRuntime,
  options: StepPlayerOptions,
): {
  surface: RoadSurface;
  contact: RoadContact | null;
} {
  if (!options.roadNetworkEnabled) return { surface: 'primary', contact: null };
  if (!options.roadContact) return { surface: 'offroad', contact: null };
  const nearest = roadResultForEdge(
    [player.longitude, player.latitude],
    options.roadContact.edge,
  );
  if (
    !nearest ||
    nearest.distanceMeters > roadAssistConfig.detectionRadiusMeters
  ) {
    return { surface: 'offroad', contact: null };
  }
  return {
    surface: options.roadContact.edge.roadClass,
    contact: { edge: options.roadContact.edge, nearest },
  };
}

export function stepPlayerDetailed(
  player: PlayerRuntime,
  input: PlayerInput,
  deltaTimeSeconds: number,
  options: StepPlayerOptions = {},
): PlayerStepResult {
  const travel = options.travel ?? travelConfig;
  const handling = options.handling ?? vehicleHandlingConfig;
  const fuel = options.fuel ?? fuelConsumptionConfig;
  const steeringSensitivity = options.steeringSensitivity ?? 'medium';
  const roadAssistMode = options.roadAssistMode ?? 'soft';
  const deltaTime = Math.min(
    MAXIMUM_DELTA_TIME_SECONDS,
    Math.max(0, deltaTimeSeconds),
  );
  const { surface, contact } = roadState(player, options);
  const speedMultiplier = roadSpeedMultipliers[surface];
  const fuelMultiplier = roadFuelMultipliers[surface];
  const hasFuel = player.fuel > 0;
  const driveEnabled = options.driveEnabled !== false;
  const throttle = hasFuel && driveEnabled ? input.throttle : 0;
  const maximumForwardSpeed =
    (input.boost ? handling.maximumBoostSpeed : handling.maximumForwardSpeed) *
    speedMultiplier;
  const maximumReverseSpeed = handling.maximumReverseSpeed * speedMultiplier;
  const targetSpeed =
    throttle > 0
      ? maximumForwardSpeed
      : throttle < 0
        ? -maximumReverseSpeed
        : 0;
  const isChangingDirection =
    (player.speedMetersPerSecond > 0 && targetSpeed < 0) ||
    (player.speedMetersPerSecond < 0 && targetSpeed > 0);
  const exceedsSurfaceLimit =
    Math.abs(player.speedMetersPerSecond) >
    (player.speedMetersPerSecond < 0
      ? maximumReverseSpeed
      : maximumForwardSpeed);
  const acceleration =
    throttle === 0
      ? driveEnabled
        ? handling.coastDeceleration
        : handling.braking
      : isChangingDirection || exceedsSurfaceLimit
        ? handling.braking
        : handling.acceleration;
  const speedMetersPerSecond = approach(
    player.speedMetersPerSecond,
    targetSpeed,
    acceleration * deltaTime,
  );
  const speedDirection = speedMetersPerSecond < 0 ? -1 : 1;
  const absoluteSpeed = Math.abs(speedMetersPerSecond);
  const steeringAuthority = Math.min(
    1,
    absoluteSpeed / Math.max(0.001, handling.minimumSteeringSpeed),
  );
  const maximumSpeedRatio = Math.min(
    1,
    absoluteSpeed / Math.max(0.001, handling.maximumBoostSpeed),
  );
  const highSpeedTurnMultiplier =
    1 - maximumSpeedRatio * (1 - handling.maximumSpeedTurnMultiplier);
  const turnRateDegreesPerSecond =
    handling.baseTurnRate *
    steeringSensitivityMultipliers[steeringSensitivity] *
    highSpeedTurnMultiplier;
  let heading = normalizeHeading(
    player.heading +
      input.turn *
        turnRateDegreesPerSecond *
        steeringAuthority *
        speedDirection *
        deltaTime,
  );

  const assistModeMultiplier = roadAssistModeMultipliers[roadAssistMode];
  const manualSteeringMultiplier = input.turn === 0 ? 1 : 0.28;
  const assistStrength =
    assistModeMultiplier *
    Math.max(0, options.roadAssistStrengthMultiplier ?? 1) *
    manualSteeringMultiplier *
    steeringAuthority;
  if (contact && assistStrength > 0) {
    const targetHeading = contact.edge.oneWay
      ? contact.nearest.heading
      : nearestBidirectionalHeading(heading, contact.nearest.heading);
    const headingCorrection = Math.min(
      1,
      roadAssistConfig.headingAssistStrength *
        assistStrength *
        roadInfluence(contact.nearest.distanceMeters) *
        deltaTime,
    );
    heading = normalizeHeading(
      heading +
        shortestHeadingDelta(heading, targetHeading) * headingCorrection,
    );
  }

  const movement = movePlayer({
    longitude: player.longitude,
    latitude: player.latitude,
    heading,
    speedMetersPerSecond,
    deltaTimeSeconds: deltaTime,
    geographicTravelScale: travel.geographicTravelScale,
  });
  let assistedPosition: RoadCoordinates = [
    movement.longitude,
    movement.latitude,
  ];
  if (contact && assistStrength > 0) {
    const projected = projectPositionOntoRoad(assistedPosition, contact.edge);
    const correction = Math.min(
      0.12,
      roadAssistConfig.snapStrength *
        assistStrength *
        roadInfluence(contact.nearest.distanceMeters) *
        deltaTime,
    );
    assistedPosition = [
      assistedPosition[0] + (projected[0] - assistedPosition[0]) * correction,
      assistedPosition[1] + (projected[1] - assistedPosition[1]) * correction,
    ];
  }

  const currentRestriction = options.restrictedAreaTypeAt?.([
    player.longitude,
    player.latitude,
  ]);
  const candidateRestriction = options.restrictedAreaTypeAt?.(assistedPosition);
  const blockedRestriction =
    candidateRestriction && !currentRestriction ? candidateRestriction : null;
  const constrained = constrainToBounds(
    assistedPosition[0],
    assistedPosition[1],
  );
  const hitBoundary =
    constrained.longitude !== assistedPosition[0] ||
    constrained.latitude !== assistedPosition[1];
  const movementBlockedBy: RestrictedAreaType | null = blockedRestriction
    ? blockedRestriction
    : hitBoundary
      ? 'out-of-bounds'
      : null;
  const blocked = movementBlockedBy !== null;
  const appliedVehicleDistanceMeters = blocked
    ? 0
    : movement.vehicleDistanceMeters;
  const appliedGeographicDistanceMeters = blocked
    ? 0
    : movement.geographicDistanceMeters;
  const fuelConsumed =
    appliedVehicleDistanceMeters *
    fuel.percentPerVehicleMeter *
    fuelMultiplier *
    (input.boost && throttle > 0 ? fuel.boostMultiplier : 1);
  const blockedPosition = hitBoundary
    ? constrained
    : { longitude: player.longitude, latitude: player.latitude };

  return {
    player: {
      longitude: blocked ? blockedPosition.longitude : assistedPosition[0],
      latitude: blocked ? blockedPosition.latitude : assistedPosition[1],
      heading,
      speedMetersPerSecond: blocked ? 0 : speedMetersPerSecond,
      fuel: Math.max(0, player.fuel - fuelConsumed),
      totalDistanceMeters:
        player.totalDistanceMeters + appliedGeographicDistanceMeters,
    },
    environment: {
      surface,
      speedMultiplier,
      fuelMultiplier,
      roadDistanceMeters: contact?.nearest.distanceMeters ?? null,
      movementBlockedBy,
    },
  };
}

export function stepPlayer(
  player: PlayerRuntime,
  input: PlayerInput,
  deltaTimeSeconds: number,
  options: StepPlayerOptions = {},
): PlayerRuntime {
  return stepPlayerDetailed(player, input, deltaTimeSeconds, options).player;
}

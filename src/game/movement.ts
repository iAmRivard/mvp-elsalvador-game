import type { PlayerInput, PlayerRuntime } from '../types/game';

const EARTH_RADIUS_METERS = 6_371_008.8;
const MAX_FORWARD_SPEED = 24;
const MAX_BOOST_SPEED = 34;
const MAX_REVERSE_SPEED = -6;
const ACCELERATION = 7;
const BRAKING = 11;
const COAST_DECELERATION = 4;
const FUEL_PERCENT_PER_METER = 0.00012;

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
}

export interface MovePlayerResult {
  longitude: number;
  latitude: number;
  heading: number;
  distanceMeters: number;
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
  const distanceMeters = input.speedMetersPerSecond * deltaTime;
  const heading = normalizeHeading(input.heading);

  if (distanceMeters === 0) {
    return {
      longitude: input.longitude,
      latitude: input.latitude,
      heading,
      distanceMeters: 0,
    };
  }

  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
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
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(destinationLatitude),
    );

  return {
    longitude: radiansToDegrees(destinationLongitude),
    latitude: radiansToDegrees(destinationLatitude),
    heading,
    distanceMeters: Math.abs(distanceMeters),
  };
}

function approach(current: number, target: number, maximumChange: number): number {
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

export function stepPlayer(
  player: PlayerRuntime,
  input: PlayerInput,
  deltaTimeSeconds: number,
): PlayerRuntime {
  const deltaTime = Math.min(0.05, Math.max(0, deltaTimeSeconds));
  const hasFuel = player.fuel > 0;
  const throttle = hasFuel ? input.throttle : 0;
  const maximumForwardSpeed = input.boost ? MAX_BOOST_SPEED : MAX_FORWARD_SPEED;
  const targetSpeed =
    throttle > 0 ? maximumForwardSpeed : throttle < 0 ? MAX_REVERSE_SPEED : 0;
  const isChangingDirection =
    (player.speedMetersPerSecond > 0 && targetSpeed < 0) ||
    (player.speedMetersPerSecond < 0 && targetSpeed > 0);
  const acceleration =
    throttle === 0 ? COAST_DECELERATION : isChangingDirection ? BRAKING : ACCELERATION;
  const speedMetersPerSecond = approach(
    player.speedMetersPerSecond,
    targetSpeed,
    acceleration * deltaTime,
  );
  const speedDirection = speedMetersPerSecond < 0 ? -1 : 1;
  const steeringAuthority = Math.min(1, Math.abs(speedMetersPerSecond) / 2.5);
  const turnRateDegreesPerSecond = 78 / (1 + Math.abs(speedMetersPerSecond) * 0.035);
  const heading = normalizeHeading(
    player.heading +
      input.turn * turnRateDegreesPerSecond * steeringAuthority * speedDirection * deltaTime,
  );
  const movement = movePlayer({
    longitude: player.longitude,
    latitude: player.latitude,
    heading,
    speedMetersPerSecond,
    deltaTimeSeconds: deltaTime,
  });
  const constrained = constrainToBounds(movement.longitude, movement.latitude);
  const hitBoundary =
    constrained.longitude !== movement.longitude || constrained.latitude !== movement.latitude;
  const appliedDistanceMeters = hitBoundary ? 0 : movement.distanceMeters;
  const fuelMultiplier = input.boost && throttle > 0 ? 1.35 : 1;
  const fuelConsumed = appliedDistanceMeters * FUEL_PERCENT_PER_METER * fuelMultiplier;

  return {
    longitude: constrained.longitude,
    latitude: constrained.latitude,
    heading,
    speedMetersPerSecond: hitBoundary ? 0 : speedMetersPerSecond,
    fuel: Math.max(0, player.fuel - fuelConsumed),
    totalDistanceMeters: player.totalDistanceMeters + appliedDistanceMeters,
  };
}

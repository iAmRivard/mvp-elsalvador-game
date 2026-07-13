import distance from '@turf/distance';
import { point } from '@turf/helpers';
import { locations, type GameLocation } from '../data/locations';

type Coordinates = [longitude: number, latitude: number];

export function distanceBetweenMeters(origin: Coordinates, destination: Coordinates): number {
  return distance(point(origin), point(destination), { units: 'meters' });
}

export function findDiscoverableLocations(
  playerCoordinates: Coordinates,
  discoveredLocationIds: readonly string[],
  unlockedLocationIds: readonly string[],
): GameLocation[] {
  const discovered = new Set(discoveredLocationIds);
  const unlocked = new Set(unlockedLocationIds);

  return locations.filter(
    (location) =>
      unlocked.has(location.id) &&
      !discovered.has(location.id) &&
      distanceBetweenMeters(playerCoordinates, location.coordinates) <=
        location.discoveryRadiusMeters,
  );
}

export function findNearestLocation(
  playerCoordinates: Coordinates,
  maximumDistanceMeters = 20_000,
): GameLocation | null {
  let nearest: GameLocation | null = null;
  let nearestDistance = maximumDistanceMeters;

  for (const location of locations) {
    const locationDistance = distanceBetweenMeters(playerCoordinates, location.coordinates);
    if (locationDistance < nearestDistance) {
      nearest = location;
      nearestDistance = locationDistance;
    }
  }

  return nearest;
}

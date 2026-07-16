import { fuelStationConfig } from '../config/fuelStations.config';
import { fuelStations, type FuelStationDefinition } from '../data/fuelStations';
import { locationById } from '../data/locations';
import { missionById } from '../data/missions';
import { distanceBetweenMeters } from './discovery';

export interface NearbyFuelStation {
  station: FuelStationDefinition;
  distanceMeters: number;
}

export type FuelAlertLevel = 'low' | 'critical' | null;
export type FuelStationPresentation = 'icon' | 'compact' | 'full';

export interface FuelStationPresentationContext {
  fuelPercent: number;
  hasActiveMission: boolean;
  selected: boolean;
  requiredByMission: boolean;
}

export function isFuelStationAvailable(
  station: FuelStationDefinition,
  chapterId: string,
): boolean {
  return (
    station.active &&
    (!station.chapterAvailability || station.chapterAvailability === chapterId)
  );
}

export function availableFuelStations(
  chapterId: string,
  stations: readonly FuelStationDefinition[] = fuelStations,
): FuelStationDefinition[] {
  return stations.filter((station) =>
    isFuelStationAvailable(station, chapterId),
  );
}

export function nearestAvailableFuelStation(
  coordinates: readonly [number, number],
  chapterId: string,
  stations: readonly FuelStationDefinition[] = fuelStations,
): NearbyFuelStation | null {
  return availableFuelStations(
    chapterId,
    stations,
  ).reduce<NearbyFuelStation | null>((nearest, station) => {
    const distanceMeters = distanceBetweenMeters(
      [coordinates[0], coordinates[1]],
      station.coordinates,
    );
    return !nearest || distanceMeters < nearest.distanceMeters
      ? { station, distanceMeters }
      : nearest;
  }, null);
}

export function isWithinFuelStationRange(distanceMeters: number): boolean {
  return distanceMeters <= fuelStationConfig.interactionRadiusMeters;
}

export function fuelAlertLevel(fuelPercent: number): FuelAlertLevel {
  if (fuelPercent < fuelStationConfig.criticalFuelThreshold) return 'critical';
  if (fuelPercent <= fuelStationConfig.lowFuelThreshold) return 'low';
  return null;
}

export function fuelStationPresentation({
  fuelPercent,
  hasActiveMission,
  selected,
  requiredByMission,
}: FuelStationPresentationContext): FuelStationPresentation {
  if (
    selected ||
    requiredByMission ||
    fuelPercent < fuelStationConfig.criticalFuelThreshold
  ) {
    return 'full';
  }
  if (fuelPercent <= fuelStationConfig.lowFuelThreshold) return 'compact';
  return hasActiveMission ? 'icon' : 'compact';
}

export function requiredFuelStationForMission(
  activeMissionId: string | null,
  completedObjectiveIds: readonly string[],
  stations: readonly FuelStationDefinition[] = fuelStations,
): FuelStationDefinition | null {
  const mission = activeMissionId ? missionById.get(activeMissionId) : null;
  const objective = mission?.objectives.find(
    (candidate) =>
      candidate.type === 'refuel' &&
      !completedObjectiveIds.includes(candidate.id),
  );
  const targetCoordinates = objective?.targetLocationId
    ? locationById.get(objective.targetLocationId)?.coordinates
    : objective?.coordinates;
  if (!targetCoordinates) return null;
  return (
    stations.find(
      (station) =>
        distanceBetweenMeters(station.coordinates, targetCoordinates) <= 20,
    ) ?? null
  );
}

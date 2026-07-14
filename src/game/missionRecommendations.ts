import { chapterOneMissionIds } from '../data/chapter1';
import { locationById } from '../data/locations';
import { missionById, missions, type Mission } from '../data/missions';
import { distanceBetweenMeters } from './discovery';

export interface RecommendedMission {
  missionId: string;
  reason: 'chapter-next' | 'optional' | 'resume';
  startLocationId: string;
  canStartNow: boolean;
  distanceToStartMeters: number;
}

function recommendationFor(
  mission: Mission,
  reason: RecommendedMission['reason'],
  playerCoordinates: [number, number],
): RecommendedMission | null {
  const start = locationById.get(mission.startLocationId);
  if (!start) return null;
  const distanceToStartMeters = distanceBetweenMeters(
    playerCoordinates,
    start.coordinates,
  );
  return {
    missionId: mission.id,
    reason,
    startLocationId: mission.startLocationId,
    canStartNow:
      reason === 'resume' ||
      distanceToStartMeters <= start.discoveryRadiusMeters,
    distanceToStartMeters,
  };
}

export function getRecommendedMission(
  completedMissionIds: readonly string[],
  activeMissionId: string | null,
  playerCoordinates: [number, number],
): RecommendedMission | null {
  if (activeMissionId) {
    const active = missionById.get(activeMissionId);
    return active
      ? recommendationFor(active, 'resume', playerCoordinates)
      : null;
  }

  const completed = new Set(completedMissionIds);
  const nextChapterMission = chapterOneMissionIds
    .map((missionId) => missionById.get(missionId))
    .find((mission): mission is Mission =>
      Boolean(mission && !completed.has(mission.id)),
    );
  if (nextChapterMission) {
    return recommendationFor(
      nextChapterMission,
      'chapter-next',
      playerCoordinates,
    );
  }

  const optionalMission = missions.find(
    (mission) =>
      mission.optional === true &&
      !completed.has(mission.id) &&
      mission.prerequisites.every((missionId) => completed.has(missionId)),
  );
  return optionalMission
    ? recommendationFor(optionalMission, 'optional', playerCoordinates)
    : null;
}

export function missionBlockExplanation(
  mission: Mission,
  completedMissionIds: readonly string[],
  playerCoordinates: [number, number],
): string | null {
  if (completedMissionIds.includes(mission.id)) return 'Misión completada';
  const missingPrerequisiteId = mission.prerequisites.find(
    (missionId) => !completedMissionIds.includes(missionId),
  );
  if (missingPrerequisiteId) {
    return `Completa primero: ${missionById.get(missingPrerequisiteId)?.title ?? 'misión anterior'}`;
  }
  const start = locationById.get(mission.startLocationId);
  if (!start) return 'Punto de inicio no disponible';
  if (
    distanceBetweenMeters(playerCoordinates, start.coordinates) >
    start.discoveryRadiusMeters
  ) {
    return `Viaja a ${start.name} para iniciarla`;
  }
  return null;
}

import {
  missionById,
  type Mission,
  type MissionObjective,
  type MissionReward,
} from '../data/missions';
import { locationById } from '../data/locations';
import type { PlayerRuntime } from '../types/game';
import { distanceBetweenMeters } from './discovery';

export type Coordinates = [longitude: number, latitude: number];

export interface MissionProgressResult {
  completedObjectiveIds: string[];
  newlyCompletedObjectiveIds: string[];
  isCompleted: boolean;
}

export interface MissionRewardSummary {
  experience: number;
  fuel: number;
  energy: number;
  unlockedLocationIds: string[];
  itemIds: string[];
  storyIds: string[];
}

export type MissionStartBlockReason =
  'completed' | 'prerequisite' | 'wrong-location' | null;

export function objectiveCoordinates(
  objective: MissionObjective,
): Coordinates | null {
  if (objective.coordinates) return objective.coordinates;
  if (!objective.targetLocationId) return null;
  return locationById.get(objective.targetLocationId)?.coordinates ?? null;
}

export function missionStartBlockReason(
  mission: Mission,
  completedMissionIds: readonly string[],
  playerCoordinates: Coordinates,
): MissionStartBlockReason {
  if (completedMissionIds.includes(mission.id)) return 'completed';
  if (!mission.prerequisites.every((id) => completedMissionIds.includes(id))) {
    return 'prerequisite';
  }

  const start = locationById.get(mission.startLocationId);
  if (!start) return 'wrong-location';
  return distanceBetweenMeters(playerCoordinates, start.coordinates) <=
    start.discoveryRadiusMeters
    ? null
    : 'wrong-location';
}

export function advanceMissionObjectives(
  mission: Mission,
  completedObjectiveIds: readonly string[],
  player: Pick<PlayerRuntime, 'longitude' | 'latitude' | 'fuel'>,
  isInteracting: boolean,
): MissionProgressResult {
  const completed = new Set(completedObjectiveIds);
  const newlyCompletedObjectiveIds: string[] = [];
  const playerCoordinates: Coordinates = [player.longitude, player.latitude];

  for (const objective of mission.objectives) {
    if (completed.has(objective.id)) continue;
    if (objective.requiresFuel && player.fuel <= 0) continue;
    if (objective.type === 'interact' && !isInteracting) continue;

    const target = objectiveCoordinates(objective);
    if (!target) continue;
    if (
      distanceBetweenMeters(playerCoordinates, target) > objective.radiusMeters
    )
      continue;

    completed.add(objective.id);
    newlyCompletedObjectiveIds.push(objective.id);
  }

  const nextCompletedObjectiveIds = mission.objectives
    .filter((objective) => completed.has(objective.id))
    .map((objective) => objective.id);

  return {
    completedObjectiveIds: nextCompletedObjectiveIds,
    newlyCompletedObjectiveIds,
    isCompleted: nextCompletedObjectiveIds.length === mission.objectives.length,
  };
}

export function nearestPendingObjective(
  mission: Mission,
  completedObjectiveIds: readonly string[],
  playerCoordinates: Coordinates,
): {
  objective: MissionObjective;
  coordinates: Coordinates;
  distanceMeters: number;
} | null {
  const completed = new Set(completedObjectiveIds);
  let nearest: ReturnType<typeof nearestPendingObjective> = null;

  for (const objective of mission.objectives) {
    if (completed.has(objective.id)) continue;
    const coordinates = objectiveCoordinates(objective);
    if (!coordinates) continue;
    const distanceMeters = distanceBetweenMeters(
      playerCoordinates,
      coordinates,
    );
    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = { objective, coordinates, distanceMeters };
    }
  }

  return nearest;
}

export function summarizeMissionRewards(
  rewards: readonly MissionReward[],
): MissionRewardSummary {
  const summary: MissionRewardSummary = {
    experience: 0,
    fuel: 0,
    energy: 0,
    unlockedLocationIds: [],
    itemIds: [],
    storyIds: [],
  };

  for (const reward of rewards) {
    if (reward.type === 'experience') summary.experience += reward.amount;
    if (reward.type === 'fuel') summary.fuel += reward.amount;
    if (reward.type === 'energy') summary.energy += reward.amount;
    if (reward.type === 'unlock-location')
      summary.unlockedLocationIds.push(reward.locationId);
    if (reward.type === 'item') summary.itemIds.push(reward.itemId);
    if (reward.type === 'story') summary.storyIds.push(reward.storyId);
  }

  return summary;
}

export function missionRewardLabel(reward: MissionReward): string {
  if (reward.type === 'experience') return `${reward.amount} XP`;
  if (reward.type === 'fuel') return `+${reward.amount}% combustible`;
  if (reward.type === 'energy') return `+${reward.amount} energía`;
  if (reward.type === 'unlock-location') {
    return `Desbloquea ${locationById.get(reward.locationId)?.name ?? 'una región'}`;
  }
  if (reward.type === 'item') return reward.label;
  return `Historia: ${reward.label}`;
}

export function activeMission(id: string | null): Mission | null {
  return id ? (missionById.get(id) ?? null) : null;
}

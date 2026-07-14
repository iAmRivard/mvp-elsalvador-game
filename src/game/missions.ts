import {
  missionById,
  type Mission,
  type MissionObjective,
  type MissionReward,
} from '../data/missions';
import { locationById } from '../data/locations';
import { vehicleStateConfig } from '../config/vehicleState.config';
import {
  addInventoryItem,
  consumeInventoryItem,
  hasInventoryItem,
  inventoryQuantity,
} from './inventory';
import type { PlayerRuntime } from '../types/game';
import type {
  InventoryEntry,
  MissionObjectiveProgressMap,
  VehicleState,
} from '../types/progression';
import { distanceBetweenMeters } from './discovery';

export type Coordinates = [longitude: number, latitude: number];

export interface MissionProgressResult {
  completedObjectiveIds: string[];
  newlyCompletedObjectiveIds: string[];
  isCompleted: boolean;
  objectiveProgress: MissionObjectiveProgressMap;
  effects: MissionObjectiveEffects;
  failedObjectiveId: string | null;
  shouldCreateCheckpoint: boolean;
}

export interface MissionObjectiveEffects {
  addItems: { itemId: string; quantity: number }[];
  consumeItems: { itemId: string; quantity: number }[];
  conditionRestored: number;
  fuelRestored: number;
  energyConsumed: number;
}

export interface MissionAdvanceContext {
  inventory: readonly InventoryEntry[];
  vehicle: VehicleState;
  energy: number;
  objectiveProgress: MissionObjectiveProgressMap;
  deltaTimeSeconds: number;
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

export function initialMissionObjectiveProgress(
  mission: Mission,
): MissionObjectiveProgressMap {
  return Object.fromEntries(
    mission.objectives.map((objective) => [
      objective.id,
      {
        value: 0,
        target: Math.max(1, objective.quantity ?? 1),
        elapsedSeconds: 0,
        durationSeconds:
          objective.type === 'timed'
            ? Math.max(1, objective.durationSeconds ?? 60)
            : null,
      },
    ]),
  );
}

export function objectiveIsAvailable(
  objective: MissionObjective,
  completedObjectiveIds: ReadonlySet<string> | readonly string[],
): boolean {
  const completed =
    completedObjectiveIds instanceof Set
      ? completedObjectiveIds
      : new Set(completedObjectiveIds);
  return (objective.prerequisiteObjectiveIds ?? []).every((objectiveId) =>
    completed.has(objectiveId),
  );
}

function isAtObjective(
  objective: MissionObjective,
  playerCoordinates: Coordinates,
): boolean {
  const target = objectiveCoordinates(objective);
  return (
    !target ||
    distanceBetweenMeters(playerCoordinates, target) <= objective.radiusMeters
  );
}

export function advanceMissionObjectives(
  mission: Mission,
  completedObjectiveIds: readonly string[],
  player: Pick<PlayerRuntime, 'longitude' | 'latitude' | 'fuel'>,
  isInteracting: boolean,
  context: Partial<MissionAdvanceContext> = {},
): MissionProgressResult {
  const completed = new Set(completedObjectiveIds);
  const newlyCompletedObjectiveIds: string[] = [];
  const playerCoordinates: Coordinates = [player.longitude, player.latitude];
  const defaults = initialMissionObjectiveProgress(mission);
  const objectiveProgress: MissionObjectiveProgressMap = Object.fromEntries(
    mission.objectives.map((objective) => [
      objective.id,
      {
        ...defaults[objective.id],
        ...context.objectiveProgress?.[objective.id],
      },
    ]),
  );
  let workingInventory = [...(context.inventory ?? [])];
  let workingVehicle: VehicleState = context.vehicle ?? {
    condition: vehicleStateConfig.initialCondition,
    fuel: player.fuel,
    maximumFuel: vehicleStateConfig.initialMaximumFuel,
  };
  let workingEnergy = context.energy ?? Number.POSITIVE_INFINITY;
  const effects: MissionObjectiveEffects = {
    addItems: [],
    consumeItems: [],
    conditionRestored: 0,
    fuelRestored: 0,
    energyConsumed: 0,
  };
  let failedObjectiveId: string | null = null;

  for (const objective of mission.objectives) {
    if (completed.has(objective.id)) continue;
    if (!objectiveIsAvailable(objective, completed)) continue;
    if (objective.requiresFuel && player.fuel <= 0) continue;
    const progress = objectiveProgress[objective.id];
    const atObjective = isAtObjective(objective, playerCoordinates);

    if (objective.type === 'timed') {
      progress.elapsedSeconds = Math.min(
        progress.durationSeconds ?? Number.POSITIVE_INFINITY,
        progress.elapsedSeconds + Math.max(0, context.deltaTimeSeconds ?? 0),
      );
      progress.value = progress.elapsedSeconds;
      progress.target = progress.durationSeconds ?? progress.target;
      if (
        !atObjective &&
        progress.elapsedSeconds >= (progress.durationSeconds ?? 0)
      ) {
        failedObjectiveId = objective.id;
        break;
      }
    }

    if (!atObjective) continue;
    const requiresInteraction = [
      'interact',
      'collect',
      'deliver',
      'repair',
      'refuel',
      'choice',
    ].includes(objective.type);
    if (requiresInteraction && !isInteracting) continue;

    if (objective.type === 'collect') {
      if (!objective.itemId) continue;
      const quantity = Math.max(1, objective.quantity ?? 1);
      const previousQuantity = inventoryQuantity(
        workingInventory,
        objective.itemId,
      );
      workingInventory = addInventoryItem(
        workingInventory,
        objective.itemId,
        quantity,
      );
      const added =
        inventoryQuantity(workingInventory, objective.itemId) -
        previousQuantity;
      if (added > 0)
        effects.addItems.push({ itemId: objective.itemId, quantity: added });
      if (!hasInventoryItem(workingInventory, objective.itemId, quantity))
        continue;
    }

    if (objective.type === 'deliver') {
      if (!objective.itemId) continue;
      const quantity = Math.max(1, objective.quantity ?? 1);
      const nextInventory = consumeInventoryItem(
        workingInventory,
        objective.itemId,
        quantity,
      );
      if (!nextInventory) continue;
      workingInventory = nextInventory;
      effects.consumeItems.push({ itemId: objective.itemId, quantity });
    }

    if (objective.type === 'repair') {
      const requiredItemId = objective.requiredItemId ?? objective.itemId;
      const quantity = Math.max(1, objective.quantity ?? 1);
      const energyCost = Math.max(0, objective.energyCost ?? 0);
      if (workingEnergy < energyCost) continue;
      if (requiredItemId) {
        const nextInventory = consumeInventoryItem(
          workingInventory,
          requiredItemId,
          quantity,
        );
        if (!nextInventory) continue;
        workingInventory = nextInventory;
        effects.consumeItems.push({ itemId: requiredItemId, quantity });
      }
      workingEnergy -= energyCost;
      effects.energyConsumed += energyCost;
      const restored = Math.min(
        Math.max(0, objective.repairAmount ?? 35),
        vehicleStateConfig.maximumCondition - workingVehicle.condition,
      );
      workingVehicle = {
        ...workingVehicle,
        condition: workingVehicle.condition + restored,
      };
      effects.conditionRestored += restored;
    }

    if (objective.type === 'refuel') {
      const requiredItemId = objective.requiredItemId ?? objective.itemId;
      const quantity = Math.max(1, objective.quantity ?? 1);
      if (requiredItemId) {
        const nextInventory = consumeInventoryItem(
          workingInventory,
          requiredItemId,
          quantity,
        );
        if (!nextInventory) continue;
        workingInventory = nextInventory;
        effects.consumeItems.push({ itemId: requiredItemId, quantity });
      }
      const restored = Math.min(
        Math.max(0, objective.refuelAmount ?? 35),
        workingVehicle.maximumFuel - workingVehicle.fuel,
      );
      workingVehicle = {
        ...workingVehicle,
        fuel: workingVehicle.fuel + restored,
      };
      effects.fuelRestored += restored;
    }

    completed.add(objective.id);
    newlyCompletedObjectiveIds.push(objective.id);
    progress.value = progress.target;
  }

  const nextCompletedObjectiveIds = mission.objectives
    .filter((objective) => completed.has(objective.id))
    .map((objective) => objective.id);

  return {
    completedObjectiveIds: nextCompletedObjectiveIds,
    newlyCompletedObjectiveIds,
    isCompleted: nextCompletedObjectiveIds.length === mission.objectives.length,
    objectiveProgress,
    effects,
    failedObjectiveId,
    shouldCreateCheckpoint: newlyCompletedObjectiveIds.length > 0,
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
    if (!objectiveIsAvailable(objective, completed)) continue;
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

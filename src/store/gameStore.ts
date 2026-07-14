import { create } from 'zustand';
import { initiallyUnlockedLocationIds, locationById } from '../data/locations';
import { missionById } from '../data/missions';
import {
  CHAPTER_ONE_ID,
  chapterRoadClosureEdgeIds,
  isChapterOneFinalMission,
  missionCompletionNarrativeEventId,
  missionStartConditionMaximum,
  missionStartNarrativeEventId,
  objectiveNarrativeEventId,
} from '../data/chapter1';
import type { RoadSurface } from '../config/roadHandling.config';
import { vehicleStateConfig } from '../config/vehicleState.config';
import {
  advanceMissionObjectives,
  initialMissionObjectiveProgress,
  missionStartBlockReason,
  objectiveIsAvailable,
  summarizeMissionRewards,
} from '../game/missions';
import {
  addInventoryItem as addItemToInventory,
  consumeInventoryItem as consumeItemFromInventory,
} from '../game/inventory';
import {
  INITIAL_ENERGY,
  INITIAL_MAX_ENERGY,
  levelForExperience,
} from '../game/progression';
import type { PlayerStepEnvironment } from '../game/movement';
import type { PlayerRuntime, PlayerTelemetry } from '../types/game';
import type { RouteNavigationInstruction } from '../types/navigation';
import type {
  CheckpointReason,
  CheckpointSnapshot,
  InventoryEntry,
  MissionObjectiveProgressMap,
  RecoveryReason,
  VehicleState,
} from '../types/progression';
import {
  browserGameStorage,
  clearGameSave,
  loadGameFromStorage,
  type PersistedGameData,
  writeGameSave,
} from './gamePersistence';

export const INITIAL_PLAYER: PlayerRuntime = {
  longitude: -89.1908911,
  latitude: 13.6962937,
  heading: 0,
  speedMetersPerSecond: 0,
  fuel: 100,
  totalDistanceMeters: 0,
};

export interface MissionCompletionEvent {
  missionId: string;
  fuelReward: number;
}

export type SaveMessage =
  | 'Partida guardada'
  | 'Partida cargada'
  | 'Partida reiniciada'
  | 'Guardado no disponible'
  | 'No hay una partida válida'
  | null;

export type RoadNetworkStatus = 'loading' | 'ready' | 'unavailable';

interface DrivingRuntimeState extends PlayerStepEnvironment {
  roadNetworkStatus: RoadNetworkStatus;
}

export type MissionRouteStatus = 'idle' | 'calculating' | 'road' | 'fallback';

export interface MissionRouteRuntimeState {
  status: MissionRouteStatus;
  distanceMeters: number | null;
  estimatedGameDurationSeconds: number | null;
  coordinateCount: number;
  activeEdgeIds: number[];
  instructions: RouteNavigationInstruction[];
  nextInstruction: RouteNavigationInstruction | null;
  distanceToNextInstructionMeters: number | null;
  offRoute: boolean;
  recalculationRevision: number;
}

interface GameData {
  telemetry: PlayerTelemetry;
  isPaused: boolean;
  isFollowingPlayer: boolean;
  currentLocationId: string | null;
  discoveredLocationIds: string[];
  unlockedLocationIds: string[];
  lastDiscoveredLocationId: string | null;
  activeMissionId: string | null;
  activeMissionCompletedObjectiveIds: string[];
  activeMissionObjectiveProgress: MissionObjectiveProgressMap;
  completedMissionIds: string[];
  lastCompletedMissionId: string | null;
  lastLevelUp: number | null;
  experience: number;
  level: number;
  energy: number;
  maxEnergy: number;
  specialItemIds: string[];
  unlockedStoryIds: string[];
  inventory: InventoryEntry[];
  vehicle: VehicleState;
  lastCheckpoint: CheckpointSnapshot;
  lastSafeCheckpoint: CheckpointSnapshot;
  currentChapterId: string;
  completedChapterIds: string[];
  roadNetworkVersion: number;
}

interface GameStore extends GameData {
  driving: DrivingRuntimeState;
  missionRoute: MissionRouteRuntimeState;
  temporarilyClosedRoadEdgeIds: number[];
  recoveryReason: RecoveryReason | null;
  activeNarrativeEventId: string | null;
  playerRuntimeRevision: number;
  hasSavedGame: boolean;
  lastSavedAt: string | null;
  saveMessage: SaveMessage;
  setTelemetry: (player: PlayerRuntime) => void;
  addInventoryItem: (itemId: string, quantity?: number) => void;
  consumeInventoryItem: (itemId: string, quantity?: number) => boolean;
  repairVehicle: (amount: number) => void;
  applyDrivingWear: (
    vehicleDistanceMeters: number,
    surface: RoadSurface,
    blockedImpact: boolean,
  ) => void;
  createCheckpoint: (reason: CheckpointReason, safe?: boolean) => void;
  retryFromCheckpoint: () => boolean;
  recoverAtLastSafeCheckpoint: (abandonMission?: boolean) => boolean;
  setRoadNetworkStatus: (status: RoadNetworkStatus) => void;
  setDrivingEnvironment: (environment: PlayerStepEnvironment) => void;
  setMissionRoute: (
    route: Omit<MissionRouteRuntimeState, 'recalculationRevision'>,
  ) => void;
  setMissionNavigation: (
    navigation: Pick<
      MissionRouteRuntimeState,
      'nextInstruction' | 'distanceToNextInstructionMeters' | 'offRoute'
    >,
  ) => void;
  requestMissionRouteRecalculation: () => void;
  setTemporarilyClosedRoadEdgeIds: (edgeIds: readonly number[]) => void;
  togglePaused: () => void;
  setPaused: (paused: boolean) => void;
  setFollowingPlayer: (following: boolean) => void;
  setCurrentLocationId: (locationId: string | null) => void;
  discoverLocation: (locationId: string) => void;
  unlockLocation: (locationId: string) => void;
  dismissDiscovery: () => void;
  addExperience: (amount: number) => void;
  consumeEnergy: (amount: number) => void;
  restoreFuel: (amount: number) => void;
  startMission: (missionId: string) => boolean;
  abandonMission: () => void;
  advanceActiveMission: (
    player: PlayerRuntime,
    isInteracting: boolean,
    deltaTimeSeconds?: number,
  ) => MissionCompletionEvent | null;
  dismissMissionCompletion: () => void;
  dismissNarrativeEvent: () => void;
  dismissLevelUp: () => void;
  saveGame: (silent?: boolean) => boolean;
  loadGame: () => boolean;
  resetGame: () => void;
  dismissSaveMessage: () => void;
}

function appendUnique(
  current: readonly string[],
  additions: readonly string[],
): string[] {
  return [...new Set([...current, ...additions])];
}

function sameNumberArray(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function telemetryFromPlayer(player: PlayerRuntime): PlayerTelemetry {
  return {
    ...player,
    speedKilometersPerHour: Math.abs(player.speedMetersPerSecond) * 3.6,
  };
}

interface CheckpointSource {
  telemetry: PlayerTelemetry;
  vehicle: VehicleState;
  inventory: InventoryEntry[];
  energy: number;
  activeMissionId: string | null;
  activeMissionCompletedObjectiveIds: string[];
  activeMissionObjectiveProgress: MissionObjectiveProgressMap;
}

function checkpointFromState(
  state: CheckpointSource,
  reason: CheckpointReason,
  id = `checkpoint-${reason}-${Date.now().toString(36)}`,
  createdAt = new Date().toISOString(),
): CheckpointSnapshot {
  return {
    id,
    createdAt,
    reason,
    player: {
      longitude: state.telemetry.longitude,
      latitude: state.telemetry.latitude,
      heading: state.telemetry.heading,
      speedMetersPerSecond: 0,
      fuel: state.vehicle.fuel,
      totalDistanceMeters: state.telemetry.totalDistanceMeters,
    },
    vehicle: { ...state.vehicle },
    inventory: state.inventory.map((entry) => ({ ...entry })),
    energy: state.energy,
    activeMissionId: state.activeMissionId,
    activeMissionCompletedObjectiveIds: [
      ...state.activeMissionCompletedObjectiveIds,
    ],
    activeMissionObjectiveProgress: structuredClone(
      state.activeMissionObjectiveProgress,
    ),
  };
}

function defaultGameData(): GameData {
  const telemetry = telemetryFromPlayer(INITIAL_PLAYER);
  const vehicle: VehicleState = {
    condition: vehicleStateConfig.initialCondition,
    fuel: INITIAL_PLAYER.fuel,
    maximumFuel: vehicleStateConfig.initialMaximumFuel,
  };
  const checkpoint = checkpointFromState(
    {
      telemetry,
      vehicle,
      inventory: [],
      energy: INITIAL_ENERGY,
      activeMissionId: null,
      activeMissionCompletedObjectiveIds: [],
      activeMissionObjectiveProgress: {},
    },
    'new-game',
    'checkpoint-new-game',
    new Date(0).toISOString(),
  );
  return {
    telemetry,
    isPaused: false,
    isFollowingPlayer: true,
    currentLocationId: 'san-salvador',
    discoveredLocationIds: [],
    unlockedLocationIds: [...initiallyUnlockedLocationIds],
    lastDiscoveredLocationId: null,
    activeMissionId: null,
    activeMissionCompletedObjectiveIds: [],
    activeMissionObjectiveProgress: {},
    completedMissionIds: [],
    lastCompletedMissionId: null,
    lastLevelUp: null,
    experience: 0,
    level: 1,
    energy: INITIAL_ENERGY,
    maxEnergy: INITIAL_MAX_ENERGY,
    specialItemIds: [],
    unlockedStoryIds: [],
    inventory: [],
    vehicle,
    lastCheckpoint: checkpoint,
    lastSafeCheckpoint: checkpoint,
    currentChapterId: 'chapter-1',
    completedChapterIds: [],
    roadNetworkVersion: 1,
  };
}

function gameDataFromPersistence(game: PersistedGameData): GameData {
  return {
    telemetry: telemetryFromPlayer(game.player),
    isPaused: game.isPaused,
    isFollowingPlayer: game.isFollowingPlayer,
    currentLocationId: null,
    discoveredLocationIds: [...game.discoveredLocationIds],
    unlockedLocationIds: [...game.unlockedLocationIds],
    lastDiscoveredLocationId: null,
    activeMissionId: game.activeMissionId,
    activeMissionCompletedObjectiveIds: [
      ...game.activeMissionCompletedObjectiveIds,
    ],
    activeMissionObjectiveProgress: structuredClone(
      game.activeMissionObjectiveProgress,
    ),
    completedMissionIds: [...game.completedMissionIds],
    lastCompletedMissionId: null,
    lastLevelUp: null,
    experience: game.experience,
    level: levelForExperience(game.experience),
    energy: game.energy,
    maxEnergy: game.maxEnergy,
    specialItemIds: [...game.specialItemIds],
    unlockedStoryIds: [...game.unlockedStoryIds],
    inventory: game.inventory.map((entry) => ({ ...entry })),
    vehicle: { ...game.vehicle },
    lastCheckpoint: structuredClone(game.lastCheckpoint),
    lastSafeCheckpoint: structuredClone(game.lastSafeCheckpoint),
    currentChapterId: game.currentChapterId,
    completedChapterIds: [...game.completedChapterIds],
    roadNetworkVersion: game.roadNetworkVersion,
  };
}

function persistableGame(state: GameData): PersistedGameData {
  return {
    player: {
      longitude: state.telemetry.longitude,
      latitude: state.telemetry.latitude,
      heading: state.telemetry.heading,
      speedMetersPerSecond: 0,
      fuel: state.telemetry.fuel,
      totalDistanceMeters: state.telemetry.totalDistanceMeters,
    },
    energy: state.energy,
    maxEnergy: state.maxEnergy,
    experience: state.experience,
    activeMissionId: state.activeMissionId,
    activeMissionCompletedObjectiveIds: [
      ...state.activeMissionCompletedObjectiveIds,
    ],
    activeMissionObjectiveProgress: structuredClone(
      state.activeMissionObjectiveProgress,
    ),
    completedMissionIds: [...state.completedMissionIds],
    discoveredLocationIds: [...state.discoveredLocationIds],
    unlockedLocationIds: [...state.unlockedLocationIds],
    specialItemIds: [...state.specialItemIds],
    unlockedStoryIds: [...state.unlockedStoryIds],
    inventory: state.inventory.map((entry) => ({ ...entry })),
    vehicle: { ...state.vehicle, fuel: state.telemetry.fuel },
    lastCheckpoint: structuredClone(state.lastCheckpoint),
    lastSafeCheckpoint: structuredClone(state.lastSafeCheckpoint),
    currentChapterId: state.currentChapterId,
    completedChapterIds: [...state.completedChapterIds],
    roadNetworkVersion: state.roadNetworkVersion,
    isPaused: state.isPaused,
    isFollowingPlayer: state.isFollowingPlayer,
  };
}

const initialLoad = loadGameFromStorage();
const initialGameData =
  initialLoad.status === 'loaded'
    ? gameDataFromPersistence(initialLoad.save.game)
    : defaultGameData();
const initialClosedRoadEdgeIds = chapterRoadClosureEdgeIds(
  initialGameData.activeMissionId,
  initialGameData.activeMissionCompletedObjectiveIds,
);

const defaultDrivingState: DrivingRuntimeState = {
  roadNetworkStatus: 'loading',
  surface: 'primary',
  speedMultiplier: 1,
  fuelMultiplier: 1,
  roadDistanceMeters: null,
  movementBlockedBy: null,
};

const defaultMissionRouteState: MissionRouteRuntimeState = {
  status: 'idle',
  distanceMeters: null,
  estimatedGameDurationSeconds: null,
  coordinateCount: 0,
  activeEdgeIds: [],
  instructions: [],
  nextInstruction: null,
  distanceToNextInstructionMeters: null,
  offRoute: false,
  recalculationRevision: 0,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialGameData,
  driving: defaultDrivingState,
  missionRoute: defaultMissionRouteState,
  temporarilyClosedRoadEdgeIds: initialClosedRoadEdgeIds,
  recoveryReason: null,
  activeNarrativeEventId: null,
  playerRuntimeRevision: 0,
  hasSavedGame: initialLoad.status === 'loaded',
  lastSavedAt:
    initialLoad.status === 'loaded' ? initialLoad.save.savedAt : null,
  saveMessage: null,
  setTelemetry: (player) =>
    set((state) => {
      const fuel = Math.min(
        state.vehicle.maximumFuel,
        Math.max(0, player.fuel),
      );
      const recoveryReason =
        fuel <= 0 ? (state.recoveryReason ?? 'fuel') : state.recoveryReason;
      return {
        telemetry: telemetryFromPlayer({ ...player, fuel }),
        vehicle: { ...state.vehicle, fuel },
        recoveryReason,
        isPaused: recoveryReason ? true : state.isPaused,
      };
    }),
  addInventoryItem: (itemId, quantity = 1) =>
    set((state) => ({
      inventory: addItemToInventory(state.inventory, itemId, quantity),
    })),
  consumeInventoryItem: (itemId, quantity = 1) => {
    let consumed = false;
    set((state) => {
      const inventory = consumeItemFromInventory(
        state.inventory,
        itemId,
        quantity,
      );
      if (!inventory) return state;
      consumed = true;
      return { inventory };
    });
    return consumed;
  },
  repairVehicle: (amount) =>
    set((state) => ({
      vehicle: {
        ...state.vehicle,
        condition: Math.min(
          vehicleStateConfig.maximumCondition,
          state.vehicle.condition + Math.max(0, amount),
        ),
      },
    })),
  applyDrivingWear: (vehicleDistanceMeters, surface, blockedImpact) =>
    set((state) => {
      const distanceDamage =
        Math.max(0, vehicleDistanceMeters) *
        (surface === 'offroad'
          ? vehicleStateConfig.offroadConditionPerVehicleMeter
          : surface === 'track'
            ? vehicleStateConfig.trackConditionPerVehicleMeter
            : 0);
      const damage =
        distanceDamage +
        (blockedImpact ? vehicleStateConfig.blockedImpactCondition : 0);
      if (damage <= 0) return state;
      const condition = Math.max(0, state.vehicle.condition - damage);
      return {
        vehicle: { ...state.vehicle, condition },
        recoveryReason:
          condition <= 0
            ? (state.recoveryReason ?? 'condition')
            : state.recoveryReason,
        isPaused: condition <= 0 ? true : state.isPaused,
      };
    }),
  createCheckpoint: (reason, safe = false) =>
    set((state) => {
      const checkpoint = checkpointFromState(state, reason);
      return {
        lastCheckpoint: checkpoint,
        lastSafeCheckpoint: safe ? checkpoint : state.lastSafeCheckpoint,
      };
    }),
  retryFromCheckpoint: () => {
    const checkpoint = get().lastCheckpoint;
    if (!checkpoint) return false;
    set((state) => ({
      telemetry: telemetryFromPlayer(checkpoint.player),
      vehicle: { ...checkpoint.vehicle },
      inventory: checkpoint.inventory.map((entry) => ({ ...entry })),
      energy: Math.min(state.maxEnergy, checkpoint.energy),
      activeMissionId: checkpoint.activeMissionId,
      activeMissionCompletedObjectiveIds: [
        ...checkpoint.activeMissionCompletedObjectiveIds,
      ],
      activeMissionObjectiveProgress: structuredClone(
        checkpoint.activeMissionObjectiveProgress,
      ),
      recoveryReason: null,
      activeNarrativeEventId: null,
      isPaused: false,
      playerRuntimeRevision: state.playerRuntimeRevision + 1,
      missionRoute: defaultMissionRouteState,
    }));
    return true;
  },
  recoverAtLastSafeCheckpoint: (abandonMission = false) => {
    const checkpoint = get().lastSafeCheckpoint;
    if (!checkpoint) return false;
    set((state) => ({
      telemetry: telemetryFromPlayer(checkpoint.player),
      vehicle: { ...checkpoint.vehicle },
      inventory: checkpoint.inventory.map((entry) => ({ ...entry })),
      energy: Math.min(state.maxEnergy, checkpoint.energy),
      activeMissionId: abandonMission ? null : checkpoint.activeMissionId,
      activeMissionCompletedObjectiveIds: abandonMission
        ? []
        : [...checkpoint.activeMissionCompletedObjectiveIds],
      activeMissionObjectiveProgress: abandonMission
        ? {}
        : structuredClone(checkpoint.activeMissionObjectiveProgress),
      recoveryReason: null,
      activeNarrativeEventId: null,
      isPaused: false,
      playerRuntimeRevision: state.playerRuntimeRevision + 1,
      missionRoute: defaultMissionRouteState,
    }));
    return true;
  },
  setRoadNetworkStatus: (roadNetworkStatus) =>
    set((state) => ({
      driving: { ...state.driving, roadNetworkStatus },
    })),
  setDrivingEnvironment: (environment) =>
    set((state) => {
      if (
        state.driving.surface === environment.surface &&
        state.driving.speedMultiplier === environment.speedMultiplier &&
        state.driving.fuelMultiplier === environment.fuelMultiplier &&
        state.driving.roadDistanceMeters === environment.roadDistanceMeters &&
        state.driving.movementBlockedBy === environment.movementBlockedBy
      ) {
        return state;
      }
      return {
        driving: {
          ...environment,
          roadNetworkStatus: state.driving.roadNetworkStatus,
        },
        recoveryReason:
          environment.movementBlockedBy === 'out-of-bounds'
            ? (state.recoveryReason ?? 'out-of-bounds')
            : state.recoveryReason,
        isPaused:
          environment.movementBlockedBy === 'out-of-bounds'
            ? true
            : state.isPaused,
      };
    }),
  setMissionRoute: (route) =>
    set((state) => ({
      missionRoute: {
        ...route,
        recalculationRevision: state.missionRoute.recalculationRevision,
      },
    })),
  setMissionNavigation: (navigation) =>
    set((state) => {
      if (
        state.missionRoute.nextInstruction === navigation.nextInstruction &&
        state.missionRoute.distanceToNextInstructionMeters ===
          navigation.distanceToNextInstructionMeters &&
        state.missionRoute.offRoute === navigation.offRoute
      ) {
        return state;
      }
      return {
        missionRoute: { ...state.missionRoute, ...navigation },
      };
    }),
  requestMissionRouteRecalculation: () =>
    set((state) => ({
      missionRoute: {
        ...state.missionRoute,
        recalculationRevision: state.missionRoute.recalculationRevision + 1,
      },
    })),
  setTemporarilyClosedRoadEdgeIds: (edgeIds) =>
    set({
      temporarilyClosedRoadEdgeIds: [
        ...new Set(
          edgeIds.filter((edgeId) => Number.isInteger(edgeId) && edgeId >= 0),
        ),
      ],
    }),
  togglePaused: () =>
    set((state) =>
      state.recoveryReason ? state : { isPaused: !state.isPaused },
    ),
  setPaused: (isPaused) =>
    set((state) => ({
      isPaused: state.recoveryReason ? true : isPaused,
    })),
  setFollowingPlayer: (isFollowingPlayer) => set({ isFollowingPlayer }),
  setCurrentLocationId: (currentLocationId) =>
    set((state) => {
      if (state.currentLocationId === currentLocationId) return state;
      const location = currentLocationId
        ? locationById.get(currentLocationId)
        : null;
      if (
        location?.type === 'city' ||
        location?.type === 'town' ||
        location?.type === 'station'
      ) {
        const checkpoint = checkpointFromState(
          state,
          location.type === 'station' ? 'fuel-station' : 'city',
        );
        return {
          currentLocationId,
          lastCheckpoint: checkpoint,
          lastSafeCheckpoint: checkpoint,
        };
      }
      return { currentLocationId };
    }),
  discoverLocation: (locationId) =>
    set((state) => {
      if (
        state.discoveredLocationIds.includes(locationId) ||
        !state.unlockedLocationIds.includes(locationId)
      ) {
        return state;
      }
      return {
        discoveredLocationIds: [...state.discoveredLocationIds, locationId],
        lastDiscoveredLocationId: locationId,
      };
    }),
  unlockLocation: (locationId) =>
    set((state) =>
      state.unlockedLocationIds.includes(locationId)
        ? state
        : { unlockedLocationIds: [...state.unlockedLocationIds, locationId] },
    ),
  dismissDiscovery: () => set({ lastDiscoveredLocationId: null }),
  addExperience: (amount) =>
    set((state) => {
      const experience = state.experience + Math.max(0, Math.floor(amount));
      const level = levelForExperience(experience);
      return {
        experience,
        level,
        lastLevelUp: level > state.level ? level : state.lastLevelUp,
      };
    }),
  consumeEnergy: (amount) =>
    set((state) => ({
      energy: Math.max(0, state.energy - Math.max(0, amount)),
    })),
  restoreFuel: (amount) =>
    set((state) => {
      const fuel = Math.min(
        state.vehicle.maximumFuel,
        state.telemetry.fuel + Math.max(0, amount),
      );
      return {
        telemetry: { ...state.telemetry, fuel },
        vehicle: { ...state.vehicle, fuel },
        playerRuntimeRevision: state.playerRuntimeRevision + 1,
      };
    }),
  startMission: (missionId) => {
    let started = false;
    set((state) => {
      const mission = missionById.get(missionId);
      if (!mission || state.activeMissionId || state.recoveryReason)
        return state;
      const reason = missionStartBlockReason(
        mission,
        state.completedMissionIds,
        [state.telemetry.longitude, state.telemetry.latitude],
      );
      if (reason) return state;

      started = true;
      const activeMissionObjectiveProgress =
        initialMissionObjectiveProgress(mission);
      const conditionMaximum = missionStartConditionMaximum(mission.id);
      const vehicle = {
        ...state.vehicle,
        condition:
          conditionMaximum === null
            ? state.vehicle.condition
            : Math.min(state.vehicle.condition, conditionMaximum),
      };
      const activeNarrativeEventId = missionStartNarrativeEventId(mission.id);
      const checkpoint = checkpointFromState(
        {
          ...state,
          vehicle,
          activeMissionId: mission.id,
          activeMissionCompletedObjectiveIds: [],
          activeMissionObjectiveProgress,
        },
        'mission-start',
      );
      return {
        activeMissionId: mission.id,
        activeMissionCompletedObjectiveIds: [],
        activeMissionObjectiveProgress,
        vehicle,
        lastCompletedMissionId: null,
        lastCheckpoint: checkpoint,
        temporarilyClosedRoadEdgeIds: chapterRoadClosureEdgeIds(mission.id, []),
        activeNarrativeEventId,
        unlockedStoryIds: activeNarrativeEventId
          ? appendUnique(state.unlockedStoryIds, [activeNarrativeEventId])
          : state.unlockedStoryIds,
        isPaused: activeNarrativeEventId ? true : state.isPaused,
      };
    });
    return started;
  },
  abandonMission: () =>
    set({
      activeMissionId: null,
      activeMissionCompletedObjectiveIds: [],
      activeMissionObjectiveProgress: {},
      temporarilyClosedRoadEdgeIds: [],
      activeNarrativeEventId: null,
    }),
  advanceActiveMission: (player, isInteracting, deltaTimeSeconds = 0.1) => {
    let completion: MissionCompletionEvent | null = null;
    set((state) => {
      const mission = state.activeMissionId
        ? missionById.get(state.activeMissionId)
        : null;
      if (!mission) return state;

      const progress = advanceMissionObjectives(
        mission,
        state.activeMissionCompletedObjectiveIds,
        player,
        isInteracting,
        {
          inventory: state.inventory,
          vehicle: state.vehicle,
          energy: state.energy,
          objectiveProgress: state.activeMissionObjectiveProgress,
          deltaTimeSeconds,
        },
      );
      let inventory = state.inventory;
      for (const addition of progress.effects.addItems) {
        inventory = addItemToInventory(
          inventory,
          addition.itemId,
          addition.quantity,
        );
      }
      for (const consumption of progress.effects.consumeItems) {
        inventory =
          consumeItemFromInventory(
            inventory,
            consumption.itemId,
            consumption.quantity,
          ) ?? inventory;
      }
      const vehicle: VehicleState = {
        ...state.vehicle,
        condition: Math.min(
          vehicleStateConfig.maximumCondition,
          state.vehicle.condition + progress.effects.conditionRestored,
        ),
        fuel: Math.min(
          state.vehicle.maximumFuel,
          player.fuel + progress.effects.fuelRestored,
        ),
      };
      const energy = Math.max(
        0,
        state.energy - progress.effects.energyConsumed,
      );
      const telemetry = telemetryFromPlayer({ ...player, fuel: vehicle.fuel });

      if (progress.failedObjectiveId) {
        return {
          activeMissionObjectiveProgress: progress.objectiveProgress,
          recoveryReason: 'timed-objective',
          isPaused: true,
        };
      }
      if (progress.newlyCompletedObjectiveIds.length === 0) {
        const completedObjectiveIds = new Set(
          state.activeMissionCompletedObjectiveIds,
        );
        const hasActiveTimedObjective = mission.objectives.some(
          (objective) =>
            objective.type === 'timed' &&
            !completedObjectiveIds.has(objective.id) &&
            objectiveIsAvailable(objective, completedObjectiveIds),
        );
        return hasActiveTimedObjective
          ? { activeMissionObjectiveProgress: progress.objectiveProgress }
          : state;
      }
      if (!progress.isCompleted) {
        const nextState = {
          ...state,
          telemetry,
          vehicle,
          inventory,
          energy,
          activeMissionCompletedObjectiveIds: progress.completedObjectiveIds,
          activeMissionObjectiveProgress: progress.objectiveProgress,
        };
        const checkpointReason =
          progress.effects.fuelRestored > 0 ? 'fuel-station' : 'objective';
        const checkpoint = checkpointFromState(nextState, checkpointReason);
        const temporarilyClosedRoadEdgeIds = chapterRoadClosureEdgeIds(
          mission.id,
          progress.completedObjectiveIds,
        );
        const closureChanged = !sameNumberArray(
          state.temporarilyClosedRoadEdgeIds,
          temporarilyClosedRoadEdgeIds,
        );
        const activeNarrativeEventId = objectiveNarrativeEventId(
          mission.id,
          progress.newlyCompletedObjectiveIds,
        );
        return {
          telemetry,
          vehicle,
          inventory,
          energy,
          activeMissionCompletedObjectiveIds: progress.completedObjectiveIds,
          activeMissionObjectiveProgress: progress.objectiveProgress,
          lastCheckpoint: checkpoint,
          lastSafeCheckpoint:
            checkpointReason === 'fuel-station'
              ? checkpoint
              : state.lastSafeCheckpoint,
          playerRuntimeRevision:
            state.playerRuntimeRevision +
            (progress.effects.fuelRestored > 0 ? 1 : 0),
          temporarilyClosedRoadEdgeIds,
          missionRoute: closureChanged
            ? {
                ...state.missionRoute,
                recalculationRevision:
                  state.missionRoute.recalculationRevision + 1,
              }
            : state.missionRoute,
          activeNarrativeEventId,
          unlockedStoryIds: activeNarrativeEventId
            ? appendUnique(state.unlockedStoryIds, [activeNarrativeEventId])
            : state.unlockedStoryIds,
          isPaused: activeNarrativeEventId ? true : state.isPaused,
        };
      }

      const rewards = summarizeMissionRewards(mission.rewards);
      const experience = state.experience + rewards.experience;
      const level = levelForExperience(experience);
      const maxEnergy = state.maxEnergy + rewards.energy;
      const rewardedFuel = Math.min(
        vehicle.maximumFuel,
        vehicle.fuel + rewards.fuel,
      );
      let rewardedInventory = inventory;
      for (const itemId of rewards.itemIds) {
        rewardedInventory = addItemToInventory(rewardedInventory, itemId, 1);
      }
      const rewardedVehicle = { ...vehicle, fuel: rewardedFuel };
      const rewardedTelemetry = telemetryFromPlayer({
        ...player,
        fuel: rewardedFuel,
      });
      completion = { missionId: mission.id, fuelReward: rewards.fuel };
      const chapterCompleted = isChapterOneFinalMission(mission.id);
      const activeNarrativeEventId = missionCompletionNarrativeEventId(
        mission.id,
      );
      const nextState = {
        ...state,
        telemetry: rewardedTelemetry,
        vehicle: rewardedVehicle,
        inventory: rewardedInventory,
        energy: Math.min(maxEnergy, energy + rewards.energy),
        activeMissionId: null,
        activeMissionCompletedObjectiveIds: [],
        activeMissionObjectiveProgress: {},
      };
      const checkpointReason = chapterCompleted
        ? 'chapter'
        : progress.effects.fuelRestored > 0
          ? 'fuel-station'
          : 'objective';
      const checkpoint = checkpointFromState(nextState, checkpointReason);
      return {
        activeMissionId: null,
        activeMissionCompletedObjectiveIds: [],
        activeMissionObjectiveProgress: {},
        completedMissionIds: appendUnique(state.completedMissionIds, [
          mission.id,
        ]),
        lastCompletedMissionId: mission.id,
        experience,
        level,
        lastLevelUp: level > state.level ? level : state.lastLevelUp,
        energy: Math.min(maxEnergy, energy + rewards.energy),
        maxEnergy,
        telemetry: rewardedTelemetry,
        vehicle: rewardedVehicle,
        inventory: rewardedInventory,
        lastCheckpoint: checkpoint,
        lastSafeCheckpoint:
          checkpointReason === 'fuel-station' || checkpointReason === 'chapter'
            ? checkpoint
            : state.lastSafeCheckpoint,
        playerRuntimeRevision:
          state.playerRuntimeRevision +
          (rewards.fuel > 0 || progress.effects.fuelRestored > 0 ? 1 : 0),
        unlockedLocationIds: appendUnique(
          state.unlockedLocationIds,
          rewards.unlockedLocationIds,
        ),
        specialItemIds: appendUnique(state.specialItemIds, rewards.itemIds),
        unlockedStoryIds: appendUnique(
          state.unlockedStoryIds,
          activeNarrativeEventId
            ? [...rewards.storyIds, activeNarrativeEventId]
            : rewards.storyIds,
        ),
        completedChapterIds: chapterCompleted
          ? appendUnique(state.completedChapterIds, [CHAPTER_ONE_ID])
          : state.completedChapterIds,
        temporarilyClosedRoadEdgeIds: [],
        activeNarrativeEventId,
        isPaused: activeNarrativeEventId ? true : state.isPaused,
      };
    });
    return completion;
  },
  dismissMissionCompletion: () => set({ lastCompletedMissionId: null }),
  dismissNarrativeEvent: () =>
    set((state) => ({
      activeNarrativeEventId: null,
      isPaused: state.recoveryReason ? true : false,
    })),
  dismissLevelUp: () => set({ lastLevelUp: null }),
  saveGame: (silent = false) => {
    const save = writeGameSave(persistableGame(get()));
    if (!save) {
      if (!silent) set({ saveMessage: 'Guardado no disponible' });
      return false;
    }
    set({
      hasSavedGame: true,
      lastSavedAt: save.savedAt,
      saveMessage: silent ? get().saveMessage : 'Partida guardada',
    });
    return true;
  },
  loadGame: () => {
    const loaded = loadGameFromStorage();
    if (loaded.status !== 'loaded') {
      set({ saveMessage: 'No hay una partida válida' });
      return false;
    }
    set((state) => ({
      ...gameDataFromPersistence(loaded.save.game),
      playerRuntimeRevision: state.playerRuntimeRevision + 1,
      hasSavedGame: true,
      lastSavedAt: loaded.save.savedAt,
      saveMessage: 'Partida cargada',
      recoveryReason: null,
      activeNarrativeEventId: null,
      temporarilyClosedRoadEdgeIds: chapterRoadClosureEdgeIds(
        loaded.save.game.activeMissionId,
        loaded.save.game.activeMissionCompletedObjectiveIds,
      ),
      missionRoute: defaultMissionRouteState,
    }));
    if (loaded.migrated) writeGameSave(loaded.save.game);
    return true;
  },
  resetGame: () => {
    clearGameSave();
    set((state) => ({
      ...defaultGameData(),
      driving: defaultDrivingState,
      missionRoute: defaultMissionRouteState,
      temporarilyClosedRoadEdgeIds: [],
      recoveryReason: null,
      activeNarrativeEventId: null,
      playerRuntimeRevision: state.playerRuntimeRevision + 1,
      hasSavedGame: false,
      lastSavedAt: null,
      saveMessage: 'Partida reiniciada',
    }));
  },
  dismissSaveMessage: () => set({ saveMessage: null }),
}));

if (initialLoad.status === 'loaded' && initialLoad.migrated) {
  writeGameSave(initialLoad.save.game);
}

export function startGameAutosave(intervalMilliseconds = 1_500): () => void {
  if (!browserGameStorage()) return () => undefined;

  let lastSignature = JSON.stringify(persistableGame(useGameStore.getState()));
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const state = useGameStore.getState();
    const signature = JSON.stringify(persistableGame(state));
    if (signature === lastSignature) return;
    lastSignature = signature;
    state.saveGame(true);
  };

  const unsubscribe = useGameStore.subscribe((state) => {
    const signature = JSON.stringify(persistableGame(state));
    if (signature === lastSignature || timer) return;
    timer = setTimeout(flush, intervalMilliseconds);
  });
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    flush();
    unsubscribe();
    window.removeEventListener('beforeunload', flush);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

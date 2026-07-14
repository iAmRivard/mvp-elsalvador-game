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
  narrativeEventById,
  objectiveNarrativeEventId,
} from '../data/chapter1';
import type { RoadSurface } from '../config/roadHandling.config';
import { vehicleStateConfig } from '../config/vehicleState.config';
import {
  conditionWarningForTransition,
  type ConditionWarningLevel,
} from '../game/conditionWarnings';
import {
  advanceMissionObjectives,
  initialMissionObjectiveProgress,
  missionStartBlockReason,
  objectiveCoordinates,
  objectiveIsAvailable,
  summarizeMissionRewards,
} from '../game/missions';
import {
  missionChoiceConsequence,
  missionChoiceOption,
  selectedMissionChoiceOption,
} from '../game/missionChoices';
import { distanceBetweenMeters } from '../game/discovery';
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
import type { RoadCoordinates } from '../types/roads';
import type {
  CheckpointReason,
  CheckpointSnapshot,
  InventoryEntry,
  MissionObjectiveProgressMap,
  RecoveryReason,
  StoryLogEntry,
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
  fuel: 75,
  totalDistanceMeters: 0,
};

export interface MissionCompletionEvent {
  missionId: string;
  fuelReward: number;
}

export type StoryLogSection =
  'history' | 'missions' | 'transmissions' | 'discoveries';

export interface GameplayFeedback {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning';
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
  missionChoiceSelections: Record<string, string>;
  storyLogEntries: StoryLogEntry[];
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
  conditionWarning: ConditionWarningLevel | null;
  conditionWarningsShown: ConditionWarningLevel[];
  activeNarrativeEventId: string | null;
  activeRadioEventId: string | null;
  activeMissionChoiceObjectiveId: string | null;
  missionTimerCountdownSeconds: number;
  gameplayFeedback: GameplayFeedback | null;
  storyLogRequest: { section: StoryLogSection; revision: number };
  playerRuntimeRevision: number;
  needsInitialRoadAlignment: boolean;
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
    conditionMultiplier?: number,
  ) => void;
  alignInitialPlayerToRoad: (
    coordinates: RoadCoordinates,
    heading: number,
  ) => boolean;
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
  dismissRadioEvent: () => void;
  selectMissionChoice: (optionId: string) => boolean;
  cancelMissionChoice: () => void;
  requestStoryLog: (section?: StoryLogSection) => void;
  dismissGameplayFeedback: () => void;
  dismissLevelUp: () => void;
  saveGame: (silent?: boolean) => boolean;
  loadGame: () => boolean;
  resetGame: () => void;
  dismissSaveMessage: () => void;
  dismissConditionWarning: () => void;
}

function appendUnique(
  current: readonly string[],
  additions: readonly string[],
): string[] {
  return [...new Set([...current, ...additions])];
}

function appendStoryLogEntry(
  entries: readonly StoryLogEntry[],
  entry: Omit<StoryLogEntry, 'recordedAt'>,
): StoryLogEntry[] {
  if (entries.some((current) => current.id === entry.id)) return [...entries];
  return [
    ...entries,
    {
      ...entry,
      recordedAt: `Registro ${String(entries.length + 1).padStart(2, '0')}`,
    },
  ];
}

function narrativeState(
  state: Pick<GameStore, 'storyLogEntries' | 'isPaused'>,
  eventId: string | null,
): Partial<GameStore> {
  if (!eventId) return {};
  const event = narrativeEventById.get(eventId);
  if (!event) return {};
  const storyLogEntries = appendStoryLogEntry(state.storyLogEntries, {
    id: `radio:${event.id}`,
    type: 'radio',
    title: event.title,
    summary: event.objectiveSummary
      ? `${event.message} ${event.objectiveSummary}`
      : event.message,
  });
  if (event.presentation === 'radio') {
    return {
      activeRadioEventId: event.id,
      storyLogEntries,
    };
  }
  return {
    activeNarrativeEventId: event.id,
    activeRadioEventId: null,
    storyLogEntries,
    isPaused: true,
  };
}

function feedback(
  state: Pick<GameStore, 'gameplayFeedback'>,
  message: string,
  tone: GameplayFeedback['tone'] = 'info',
): GameplayFeedback {
  return {
    id: (state.gameplayFeedback?.id ?? 0) + 1,
    message,
    tone,
  };
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
  missionChoiceSelections: Record<string, string>;
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
    missionChoiceSelections: { ...state.missionChoiceSelections },
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
      missionChoiceSelections: {},
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
    missionChoiceSelections: {},
    storyLogEntries: [],
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
    missionChoiceSelections: { ...game.missionChoiceSelections },
    storyLogEntries: game.storyLogEntries.map((entry) => ({ ...entry })),
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
    missionChoiceSelections: { ...state.missionChoiceSelections },
    storyLogEntries: state.storyLogEntries.map((entry) => ({ ...entry })),
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
  initialGameData.missionChoiceSelections,
);
const recoveryReasonForGame = (game: GameData): RecoveryReason | null => {
  if (game.vehicle.condition <= 0) return 'condition';
  if (game.telemetry.fuel <= 0) return 'fuel';
  return null;
};
const initialRecoveryReason = recoveryReasonForGame(initialGameData);

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
  isPaused: initialRecoveryReason ? true : initialGameData.isPaused,
  driving: defaultDrivingState,
  missionRoute: defaultMissionRouteState,
  temporarilyClosedRoadEdgeIds: initialClosedRoadEdgeIds,
  recoveryReason: initialRecoveryReason,
  conditionWarning: null,
  conditionWarningsShown: [],
  activeNarrativeEventId: null,
  activeRadioEventId: null,
  activeMissionChoiceObjectiveId: null,
  missionTimerCountdownSeconds: 0,
  gameplayFeedback: null,
  storyLogRequest: { section: 'missions', revision: 0 },
  playerRuntimeRevision: 0,
  needsInitialRoadAlignment: initialLoad.status !== 'loaded',
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
  applyDrivingWear: (
    vehicleDistanceMeters,
    surface,
    blockedImpact,
    conditionMultiplier = 1,
  ) =>
    set((state) => {
      if (state.driving.roadNetworkStatus !== 'ready') return state;
      const distanceDamage =
        Math.max(0, vehicleDistanceMeters) *
        (surface === 'offroad'
          ? vehicleStateConfig.offroadConditionPerVehicleMeter
          : surface === 'track'
            ? vehicleStateConfig.trackConditionPerVehicleMeter
            : 0) *
        Math.max(0.1, conditionMultiplier);
      const damage =
        distanceDamage +
        (blockedImpact ? vehicleStateConfig.blockedImpactCondition : 0);
      if (damage <= 0) return state;
      const condition = Math.max(0, state.vehicle.condition - damage);
      const nextWarning = conditionWarningForTransition(
        state.vehicle.condition,
        condition,
      );
      const shouldShowWarning =
        nextWarning !== null &&
        !state.conditionWarningsShown.includes(nextWarning);
      return {
        vehicle: { ...state.vehicle, condition },
        conditionWarning: shouldShowWarning
          ? nextWarning
          : state.conditionWarning,
        conditionWarningsShown: shouldShowWarning
          ? [...state.conditionWarningsShown, nextWarning]
          : state.conditionWarningsShown,
        recoveryReason:
          condition <= 0
            ? (state.recoveryReason ?? 'condition')
            : state.recoveryReason,
        isPaused: condition <= 0 ? true : state.isPaused,
      };
    }),
  alignInitialPlayerToRoad: (coordinates, heading) => {
    let aligned = false;
    set((state) => {
      if (!state.needsInitialRoadAlignment) return state;
      const telemetry = telemetryFromPlayer({
        ...state.telemetry,
        longitude: coordinates[0],
        latitude: coordinates[1],
        heading,
        speedMetersPerSecond: 0,
      });
      const checkpoint = checkpointFromState(
        { ...state, telemetry },
        'new-game',
        'checkpoint-new-game',
        new Date(0).toISOString(),
      );
      aligned = true;
      return {
        telemetry,
        lastCheckpoint: checkpoint,
        lastSafeCheckpoint: checkpoint,
        needsInitialRoadAlignment: false,
        playerRuntimeRevision: state.playerRuntimeRevision + 1,
      };
    });
    return aligned;
  },
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
      missionChoiceSelections: { ...checkpoint.missionChoiceSelections },
      recoveryReason: null,
      activeNarrativeEventId: null,
      activeRadioEventId: null,
      activeMissionChoiceObjectiveId: null,
      missionTimerCountdownSeconds: 0,
      isPaused: false,
      playerRuntimeRevision: state.playerRuntimeRevision + 1,
      missionRoute: defaultMissionRouteState,
      temporarilyClosedRoadEdgeIds: chapterRoadClosureEdgeIds(
        checkpoint.activeMissionId,
        checkpoint.activeMissionCompletedObjectiveIds,
        checkpoint.missionChoiceSelections,
      ),
    }));
    return true;
  },
  recoverAtLastSafeCheckpoint: (abandonMission = false) => {
    const checkpoint = get().lastSafeCheckpoint;
    if (!checkpoint) return false;
    set((state) => {
      const vehicle = {
        ...checkpoint.vehicle,
        fuel:
          state.recoveryReason === 'fuel'
            ? Math.max(
                checkpoint.vehicle.fuel,
                vehicleStateConfig.emergencyRecoveryFuel,
              )
            : checkpoint.vehicle.fuel,
        condition:
          state.recoveryReason === 'condition'
            ? Math.max(
                checkpoint.vehicle.condition,
                vehicleStateConfig.emergencyRecoveryCondition,
              )
            : checkpoint.vehicle.condition,
      };
      return {
        telemetry: telemetryFromPlayer({
          ...checkpoint.player,
          fuel: vehicle.fuel,
        }),
        vehicle,
        inventory: checkpoint.inventory.map((entry) => ({ ...entry })),
        energy: Math.min(state.maxEnergy, checkpoint.energy),
        activeMissionId: abandonMission ? null : checkpoint.activeMissionId,
        activeMissionCompletedObjectiveIds: abandonMission
          ? []
          : [...checkpoint.activeMissionCompletedObjectiveIds],
        activeMissionObjectiveProgress: abandonMission
          ? {}
          : structuredClone(checkpoint.activeMissionObjectiveProgress),
        missionChoiceSelections: { ...checkpoint.missionChoiceSelections },
        recoveryReason: null,
        activeNarrativeEventId: null,
        activeRadioEventId: null,
        activeMissionChoiceObjectiveId: null,
        missionTimerCountdownSeconds: 0,
        isPaused: false,
        playerRuntimeRevision: state.playerRuntimeRevision + 1,
        missionRoute: defaultMissionRouteState,
        temporarilyClosedRoadEdgeIds: chapterRoadClosureEdgeIds(
          abandonMission ? null : checkpoint.activeMissionId,
          abandonMission ? [] : checkpoint.activeMissionCompletedObjectiveIds,
          checkpoint.missionChoiceSelections,
        ),
        gameplayFeedback: feedback(
          state,
          state.recoveryReason === 'fuel'
            ? `Recuperación de emergencia: ${vehicle.fuel.toFixed(0)}% de combustible`
            : 'Vehículo recuperado en el último punto seguro',
          'warning',
        ),
      };
    });
    return true;
  },
  setRoadNetworkStatus: (roadNetworkStatus) =>
    set((state) => ({
      driving:
        roadNetworkStatus === 'ready'
          ? { ...state.driving, roadNetworkStatus }
          : { ...defaultDrivingState, roadNetworkStatus },
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
      state.recoveryReason ||
      state.activeNarrativeEventId ||
      state.activeMissionChoiceObjectiveId
        ? state
        : { isPaused: !state.isPaused },
    ),
  setPaused: (isPaused) =>
    set((state) => ({
      isPaused:
        state.recoveryReason ||
        state.activeNarrativeEventId ||
        state.activeMissionChoiceObjectiveId
          ? true
          : isPaused,
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
      const location = locationById.get(locationId);
      return {
        discoveredLocationIds: [...state.discoveredLocationIds, locationId],
        lastDiscoveredLocationId: locationId,
        storyLogEntries: location
          ? appendStoryLogEntry(state.storyLogEntries, {
              id: `discovery:${location.id}`,
              type: 'discovery',
              title: location.name,
              summary: location.description,
            })
          : state.storyLogEntries,
        gameplayFeedback: location
          ? feedback(state, `Descubrimiento: ${location.name}`, 'success')
          : state.gameplayFeedback,
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
      const storyLogEntries = appendStoryLogEntry(state.storyLogEntries, {
        id: `mission-start:${mission.id}`,
        type: 'mission',
        title: `Misión iniciada: ${mission.title}`,
        summary: mission.description,
      });
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
        lastDiscoveredLocationId: null,
        lastCheckpoint: checkpoint,
        temporarilyClosedRoadEdgeIds: chapterRoadClosureEdgeIds(
          mission.id,
          [],
          state.missionChoiceSelections,
        ),
        activeNarrativeEventId: null,
        activeRadioEventId: null,
        activeMissionChoiceObjectiveId: null,
        missionTimerCountdownSeconds: 0,
        storyLogEntries,
        unlockedStoryIds: activeNarrativeEventId
          ? appendUnique(state.unlockedStoryIds, [activeNarrativeEventId])
          : state.unlockedStoryIds,
        gameplayFeedback: feedback(state, 'Ruta de misión activada', 'success'),
        ...narrativeState(
          { storyLogEntries, isPaused: state.isPaused },
          activeNarrativeEventId,
        ),
      };
    });
    return started;
  },
  abandonMission: () =>
    set((state) => {
      const missionChoiceSelections = { ...state.missionChoiceSelections };
      if (state.activeMissionId)
        delete missionChoiceSelections[state.activeMissionId];
      return {
        activeMissionId: null,
        activeMissionCompletedObjectiveIds: [],
        activeMissionObjectiveProgress: {},
        missionChoiceSelections,
        temporarilyClosedRoadEdgeIds: [],
        activeNarrativeEventId: null,
        activeRadioEventId: null,
        activeMissionChoiceObjectiveId: null,
        missionTimerCountdownSeconds: 0,
        isPaused: false,
      };
    }),
  advanceActiveMission: (player, isInteracting, deltaTimeSeconds = 0.1) => {
    let completion: MissionCompletionEvent | null = null;
    set((state) => {
      const mission = state.activeMissionId
        ? missionById.get(state.activeMissionId)
        : null;
      if (!mission) return state;
      if (state.isPaused) return state;

      const completedObjectiveIds = new Set(
        state.activeMissionCompletedObjectiveIds,
      );
      const pendingChoice = mission.objectives.find(
        (objective) =>
          objective.type === 'choice' &&
          !completedObjectiveIds.has(objective.id) &&
          objectiveIsAvailable(objective, completedObjectiveIds),
      );
      const pendingChoiceCoordinates = pendingChoice
        ? objectiveCoordinates(pendingChoice)
        : null;
      if (
        isInteracting &&
        pendingChoice &&
        pendingChoiceCoordinates &&
        !state.missionChoiceSelections[mission.id] &&
        distanceBetweenMeters(
          [player.longitude, player.latitude],
          pendingChoiceCoordinates,
        ) <= pendingChoice.radiusMeters
      ) {
        return {
          activeMissionChoiceObjectiveId: pendingChoice.id,
          activeRadioEventId: null,
          isPaused: true,
        };
      }

      if (state.missionTimerCountdownSeconds > 0) {
        const missionTimerCountdownSeconds = Math.max(
          0,
          state.missionTimerCountdownSeconds - Math.max(0, deltaTimeSeconds),
        );
        return {
          missionTimerCountdownSeconds,
          gameplayFeedback:
            missionTimerCountdownSeconds === 0
              ? feedback(state, 'Señal inestable: el tiempo comenzó', 'warning')
              : state.gameplayFeedback,
        };
      }

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
          selectedChoiceOptionId:
            state.missionChoiceSelections[mission.id] ?? null,
          timedObjectiveStartAllowed: true,
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
          gameplayFeedback: feedback(
            state,
            'La señal se perdió antes de llegar a la estación',
            'warning',
          ),
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
        const completedChoice = mission.objectives.some(
          (objective) =>
            objective.type === 'choice' &&
            progress.newlyCompletedObjectiveIds.includes(objective.id),
        );
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
        const checkpoint = completedChoice
          ? state.lastCheckpoint
          : checkpointFromState(nextState, checkpointReason);
        const temporarilyClosedRoadEdgeIds = chapterRoadClosureEdgeIds(
          mission.id,
          progress.completedObjectiveIds,
          state.missionChoiceSelections,
        );
        const closureChanged = !sameNumberArray(
          state.temporarilyClosedRoadEdgeIds,
          temporarilyClosedRoadEdgeIds,
        );
        const narrativeEventId = objectiveNarrativeEventId(
          mission.id,
          progress.newlyCompletedObjectiveIds,
        );
        const objectiveFeedback =
          progress.effects.fuelRestored > 0
            ? `Combustible +${progress.effects.fuelRestored.toFixed(0)}%`
            : progress.effects.conditionRestored > 0
              ? `Condición +${progress.effects.conditionRestored.toFixed(0)}%`
              : progress.effects.addItems.some(
                    (item) => item.itemId === 'bidon-combustible',
                  )
                ? 'Bidón de combustible recogido'
                : progress.effects.addItems.some(
                      (item) => item.itemId === 'rele-encendido',
                    )
                  ? 'Relé de encendido recogido'
                  : completedChoice
                    ? 'Ruta recalculada'
                    : 'Objetivo actualizado';
        return {
          telemetry,
          vehicle,
          inventory,
          energy,
          activeMissionCompletedObjectiveIds: progress.completedObjectiveIds,
          activeMissionObjectiveProgress: progress.objectiveProgress,
          lastCheckpoint: checkpoint,
          lastSafeCheckpoint:
            !completedChoice && checkpointReason === 'fuel-station'
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
          unlockedStoryIds: narrativeEventId
            ? appendUnique(state.unlockedStoryIds, [narrativeEventId])
            : state.unlockedStoryIds,
          gameplayFeedback: feedback(
            state,
            objectiveFeedback,
            completedChoice || progress.effects.addItems.length > 0
              ? 'success'
              : 'info',
          ),
          ...narrativeState(state, narrativeEventId),
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
      const selectedChoice = selectedMissionChoiceOption(
        mission.id,
        state.missionChoiceSelections,
      );
      const routeConditionCost = selectedChoice
        ? (selectedChoice.conditionMultiplier ?? 1) > 1
          ? 8
          : 2
        : 0;
      const rewardedVehicle = {
        ...vehicle,
        condition: Math.max(0, vehicle.condition - routeConditionCost),
        fuel: rewardedFuel,
      };
      const rewardedTelemetry = telemetryFromPlayer({
        ...player,
        fuel: rewardedFuel,
      });
      completion = { missionId: mission.id, fuelReward: rewards.fuel };
      const chapterCompleted = isChapterOneFinalMission(mission.id);
      const activeNarrativeEventId = missionCompletionNarrativeEventId(
        mission.id,
      );
      const storyLogEntries = appendStoryLogEntry(state.storyLogEntries, {
        id: `mission-complete:${mission.id}`,
        type: 'mission',
        title: `Misión completada: ${mission.title}`,
        summary: selectedChoice
          ? `${mission.completionSummary} ${missionChoiceConsequence(selectedChoice)}`
          : mission.completionSummary,
      });
      const nextState = {
        ...state,
        telemetry: rewardedTelemetry,
        vehicle: rewardedVehicle,
        inventory: rewardedInventory,
        energy: Math.min(maxEnergy, energy + rewards.energy),
        activeMissionId: null,
        activeMissionCompletedObjectiveIds: [],
        activeMissionObjectiveProgress: {},
        storyLogEntries,
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
        activeNarrativeEventId: null,
        activeRadioEventId: null,
        activeMissionChoiceObjectiveId: null,
        missionTimerCountdownSeconds: 0,
        storyLogEntries,
        gameplayFeedback:
          routeConditionCost > 0
            ? feedback(
                state,
                `Consecuencia de ruta: condición -${String(routeConditionCost)}%`,
                routeConditionCost >= 8 ? 'warning' : 'info',
              )
            : state.gameplayFeedback,
        ...narrativeState(
          { storyLogEntries, isPaused: state.isPaused },
          activeNarrativeEventId,
        ),
      };
    });
    return completion;
  },
  dismissMissionCompletion: () => set({ lastCompletedMissionId: null }),
  dismissNarrativeEvent: () =>
    set((state) => ({
      activeNarrativeEventId: null,
      isPaused: Boolean(
        state.recoveryReason || state.activeMissionChoiceObjectiveId,
      ),
    })),
  dismissRadioEvent: () => set({ activeRadioEventId: null }),
  selectMissionChoice: (optionId) => {
    const state = get();
    const mission = state.activeMissionId
      ? missionById.get(state.activeMissionId)
      : null;
    const objective = mission?.objectives.find(
      (candidate) => candidate.id === state.activeMissionChoiceObjectiveId,
    );
    const option = objective ? missionChoiceOption(objective, optionId) : null;
    if (
      !mission ||
      !objective ||
      !option ||
      state.missionChoiceSelections[mission.id]
    ) {
      return false;
    }

    const storyLogEntries = appendStoryLogEntry(state.storyLogEntries, {
      id: `choice:${mission.id}`,
      type: 'mission',
      title: `Ruta elegida: ${option.label}`,
      summary: `${option.description} ${missionChoiceConsequence(option)}`,
    });
    set({
      missionChoiceSelections: {
        ...state.missionChoiceSelections,
        [mission.id]: option.id,
      },
      storyLogEntries,
      activeMissionChoiceObjectiveId: null,
      isPaused: false,
    });
    get().advanceActiveMission(get().telemetry, true, 0);
    set((current) => ({
      missionTimerCountdownSeconds: 3,
      temporarilyClosedRoadEdgeIds: [
        ...(option.closedRoadEdgeIds ?? current.temporarilyClosedRoadEdgeIds),
      ],
      missionRoute: {
        ...current.missionRoute,
        recalculationRevision: current.missionRoute.recalculationRevision + 1,
      },
      gameplayFeedback: feedback(
        current,
        `Ruta recalculada · ${missionChoiceConsequence(option)}`,
        option.risk === 'high' ? 'warning' : 'success',
      ),
    }));
    return true;
  },
  cancelMissionChoice: () =>
    set((state) => ({
      activeMissionChoiceObjectiveId: null,
      isPaused: Boolean(state.recoveryReason || state.activeNarrativeEventId),
    })),
  requestStoryLog: (section = 'history') =>
    set((state) => ({
      storyLogRequest: {
        section,
        revision: state.storyLogRequest.revision + 1,
      },
    })),
  dismissGameplayFeedback: () => set({ gameplayFeedback: null }),
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
    set((state) => {
      const game = gameDataFromPersistence(loaded.save.game);
      const recoveryReason = recoveryReasonForGame(game);
      return {
        ...game,
        isPaused: recoveryReason ? true : game.isPaused,
        playerRuntimeRevision: state.playerRuntimeRevision + 1,
        hasSavedGame: true,
        lastSavedAt: loaded.save.savedAt,
        saveMessage: 'Partida cargada',
        recoveryReason,
        conditionWarning: null,
        conditionWarningsShown: [],
        activeNarrativeEventId: null,
        activeRadioEventId: null,
        activeMissionChoiceObjectiveId: null,
        missionTimerCountdownSeconds: 0,
        gameplayFeedback: null,
        needsInitialRoadAlignment: false,
        temporarilyClosedRoadEdgeIds: chapterRoadClosureEdgeIds(
          loaded.save.game.activeMissionId,
          loaded.save.game.activeMissionCompletedObjectiveIds,
          loaded.save.game.missionChoiceSelections,
        ),
        missionRoute: defaultMissionRouteState,
      };
    });
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
      conditionWarning: null,
      conditionWarningsShown: [],
      activeNarrativeEventId: null,
      activeRadioEventId: null,
      activeMissionChoiceObjectiveId: null,
      missionTimerCountdownSeconds: 0,
      gameplayFeedback: null,
      storyLogRequest: { section: 'missions', revision: 0 },
      needsInitialRoadAlignment: true,
      playerRuntimeRevision: state.playerRuntimeRevision + 1,
      hasSavedGame: false,
      lastSavedAt: null,
      saveMessage: 'Partida reiniciada',
    }));
  },
  dismissSaveMessage: () => set({ saveMessage: null }),
  dismissConditionWarning: () => set({ conditionWarning: null }),
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

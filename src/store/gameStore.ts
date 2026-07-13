import { create } from 'zustand';
import { initiallyUnlockedLocationIds } from '../data/locations';
import { missionById } from '../data/missions';
import {
  advanceMissionObjectives,
  missionStartBlockReason,
  summarizeMissionRewards,
} from '../game/missions';
import {
  INITIAL_ENERGY,
  INITIAL_MAX_ENERGY,
  levelForExperience,
} from '../game/progression';
import type { PlayerRuntime, PlayerTelemetry } from '../types/game';
import {
  browserGameStorage,
  clearGameSave,
  loadGameFromStorage,
  type PersistedGameData,
  writeGameSave,
} from './gamePersistence';

export const INITIAL_PLAYER: PlayerRuntime = {
  longitude: -89.191111,
  latitude: 13.6975,
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
  completedMissionIds: string[];
  lastCompletedMissionId: string | null;
  lastLevelUp: number | null;
  experience: number;
  level: number;
  energy: number;
  maxEnergy: number;
  specialItemIds: string[];
  unlockedStoryIds: string[];
}

interface GameStore extends GameData {
  playerRuntimeRevision: number;
  hasSavedGame: boolean;
  lastSavedAt: string | null;
  saveMessage: SaveMessage;
  setTelemetry: (player: PlayerRuntime) => void;
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
  ) => MissionCompletionEvent | null;
  dismissMissionCompletion: () => void;
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

function telemetryFromPlayer(player: PlayerRuntime): PlayerTelemetry {
  return {
    ...player,
    speedKilometersPerHour: Math.abs(player.speedMetersPerSecond) * 3.6,
  };
}

function defaultGameData(): GameData {
  return {
    telemetry: telemetryFromPlayer(INITIAL_PLAYER),
    isPaused: false,
    isFollowingPlayer: true,
    currentLocationId: 'san-salvador',
    discoveredLocationIds: [],
    unlockedLocationIds: [...initiallyUnlockedLocationIds],
    lastDiscoveredLocationId: null,
    activeMissionId: null,
    activeMissionCompletedObjectiveIds: [],
    completedMissionIds: [],
    lastCompletedMissionId: null,
    lastLevelUp: null,
    experience: 0,
    level: 1,
    energy: INITIAL_ENERGY,
    maxEnergy: INITIAL_MAX_ENERGY,
    specialItemIds: [],
    unlockedStoryIds: [],
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
    completedMissionIds: [...game.completedMissionIds],
    lastCompletedMissionId: null,
    lastLevelUp: null,
    experience: game.experience,
    level: levelForExperience(game.experience),
    energy: game.energy,
    maxEnergy: game.maxEnergy,
    specialItemIds: [...game.specialItemIds],
    unlockedStoryIds: [...game.unlockedStoryIds],
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
    completedMissionIds: [...state.completedMissionIds],
    discoveredLocationIds: [...state.discoveredLocationIds],
    unlockedLocationIds: [...state.unlockedLocationIds],
    specialItemIds: [...state.specialItemIds],
    unlockedStoryIds: [...state.unlockedStoryIds],
    isPaused: state.isPaused,
    isFollowingPlayer: state.isFollowingPlayer,
  };
}

const initialLoad = loadGameFromStorage();
const initialGameData =
  initialLoad.status === 'loaded'
    ? gameDataFromPersistence(initialLoad.save.game)
    : defaultGameData();

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialGameData,
  playerRuntimeRevision: 0,
  hasSavedGame: initialLoad.status === 'loaded',
  lastSavedAt:
    initialLoad.status === 'loaded' ? initialLoad.save.savedAt : null,
  saveMessage: null,
  setTelemetry: (player) => set({ telemetry: telemetryFromPlayer(player) }),
  togglePaused: () => set((state) => ({ isPaused: !state.isPaused })),
  setPaused: (isPaused) => set({ isPaused }),
  setFollowingPlayer: (isFollowingPlayer) => set({ isFollowingPlayer }),
  setCurrentLocationId: (currentLocationId) =>
    set((state) =>
      state.currentLocationId === currentLocationId
        ? state
        : { currentLocationId },
    ),
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
    set((state) => ({
      telemetry: {
        ...state.telemetry,
        fuel: Math.min(100, state.telemetry.fuel + Math.max(0, amount)),
      },
      playerRuntimeRevision: state.playerRuntimeRevision + 1,
    })),
  startMission: (missionId) => {
    let started = false;
    set((state) => {
      const mission = missionById.get(missionId);
      if (!mission || state.activeMissionId) return state;
      const reason = missionStartBlockReason(
        mission,
        state.completedMissionIds,
        [state.telemetry.longitude, state.telemetry.latitude],
      );
      if (reason) return state;

      started = true;
      return {
        activeMissionId: mission.id,
        activeMissionCompletedObjectiveIds: [],
        lastCompletedMissionId: null,
      };
    });
    return started;
  },
  abandonMission: () =>
    set({ activeMissionId: null, activeMissionCompletedObjectiveIds: [] }),
  advanceActiveMission: (player, isInteracting) => {
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
      );
      if (progress.newlyCompletedObjectiveIds.length === 0) return state;
      if (!progress.isCompleted) {
        return {
          activeMissionCompletedObjectiveIds: progress.completedObjectiveIds,
        };
      }

      const rewards = summarizeMissionRewards(mission.rewards);
      const experience = state.experience + rewards.experience;
      const level = levelForExperience(experience);
      const maxEnergy = state.maxEnergy + rewards.energy;
      completion = { missionId: mission.id, fuelReward: rewards.fuel };
      return {
        activeMissionId: null,
        activeMissionCompletedObjectiveIds: [],
        completedMissionIds: appendUnique(state.completedMissionIds, [
          mission.id,
        ]),
        lastCompletedMissionId: mission.id,
        experience,
        level,
        lastLevelUp: level > state.level ? level : state.lastLevelUp,
        energy: Math.min(maxEnergy, state.energy + rewards.energy),
        maxEnergy,
        telemetry: telemetryFromPlayer({
          ...player,
          fuel: Math.min(100, player.fuel + rewards.fuel),
        }),
        playerRuntimeRevision:
          state.playerRuntimeRevision + (rewards.fuel > 0 ? 1 : 0),
        unlockedLocationIds: appendUnique(
          state.unlockedLocationIds,
          rewards.unlockedLocationIds,
        ),
        specialItemIds: appendUnique(state.specialItemIds, rewards.itemIds),
        unlockedStoryIds: appendUnique(
          state.unlockedStoryIds,
          rewards.storyIds,
        ),
      };
    });
    return completion;
  },
  dismissMissionCompletion: () => set({ lastCompletedMissionId: null }),
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
    }));
    if (loaded.migrated) writeGameSave(loaded.save.game);
    return true;
  },
  resetGame: () => {
    clearGameSave();
    set((state) => ({
      ...defaultGameData(),
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

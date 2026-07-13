import { initiallyUnlockedLocationIds, locations } from '../data/locations';
import { missionById, missions } from '../data/missions';
import { INITIAL_ENERGY, INITIAL_MAX_ENERGY } from '../game/progression';
import {
  EL_SALVADOR_MOVEMENT_BOUNDS,
  normalizeHeading,
} from '../game/movement';
import type { PlayerRuntime } from '../types/game';

export const GAME_SAVE_KEY = 'el-salvador-rutas-perdidas:save';
export const GAME_SAVE_VERSION = 1;

export interface PersistedGameData {
  player: PlayerRuntime;
  energy: number;
  maxEnergy: number;
  experience: number;
  activeMissionId: string | null;
  activeMissionCompletedObjectiveIds: string[];
  completedMissionIds: string[];
  discoveredLocationIds: string[];
  unlockedLocationIds: string[];
  specialItemIds: string[];
  unlockedStoryIds: string[];
  isPaused: boolean;
  isFollowingPlayer: boolean;
}

export interface GameSaveEnvelope {
  version: typeof GAME_SAVE_VERSION;
  savedAt: string;
  game: PersistedGameData;
}

export interface GameStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export type LoadGameResult =
  | { status: 'loaded'; save: GameSaveEnvelope; migrated: boolean }
  | { status: 'empty' | 'invalid' | 'unavailable' };

const locationIds = new Set(locations.map((location) => location.id));
const missionIds = new Set(missions.map((mission) => mission.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter((entry): entry is string => typeof entry === 'string'),
        ),
      ]
    : [];
}

function validLocationIds(value: unknown): string[] {
  return stringArray(value).filter((id) => locationIds.has(id));
}

function validMissionIds(value: unknown): string[] {
  return stringArray(value).filter((id) => missionIds.has(id));
}

function sanitizedPlayer(value: unknown): PlayerRuntime {
  const record = isRecord(value) ? value : {};
  const longitude = clamp(
    finiteNumber(record.longitude, -89.191111),
    EL_SALVADOR_MOVEMENT_BOUNDS.west,
    EL_SALVADOR_MOVEMENT_BOUNDS.east,
  );
  const latitude = clamp(
    finiteNumber(record.latitude, 13.6975),
    EL_SALVADOR_MOVEMENT_BOUNDS.south,
    EL_SALVADOR_MOVEMENT_BOUNDS.north,
  );

  return {
    longitude,
    latitude,
    heading: normalizeHeading(finiteNumber(record.heading, 0)),
    speedMetersPerSecond: 0,
    fuel: clamp(finiteNumber(record.fuel, 100), 0, 100),
    totalDistanceMeters: Math.max(
      0,
      finiteNumber(record.totalDistanceMeters, 0),
    ),
  };
}

function sanitizeGame(value: unknown): PersistedGameData | null {
  if (!isRecord(value)) return null;
  const completedMissionIds = validMissionIds(value.completedMissionIds);
  const candidateActiveMissionId =
    typeof value.activeMissionId === 'string' &&
    missionIds.has(value.activeMissionId) &&
    !completedMissionIds.includes(value.activeMissionId)
      ? value.activeMissionId
      : null;
  const candidateActiveMission = candidateActiveMissionId
    ? missionById.get(candidateActiveMissionId)
    : null;
  const requestedActiveMissionId =
    candidateActiveMission &&
    candidateActiveMission.prerequisites.every((id) =>
      completedMissionIds.includes(id),
    )
      ? candidateActiveMission.id
      : null;
  const activeMission = requestedActiveMissionId
    ? missionById.get(requestedActiveMissionId)
    : null;
  const allowedObjectiveIds = new Set(
    activeMission?.objectives.map((objective) => objective.id) ?? [],
  );
  const unlockedLocationIds = [
    ...new Set([
      ...initiallyUnlockedLocationIds,
      ...validLocationIds(value.unlockedLocationIds),
    ]),
  ];
  const requestedEnergy = finiteNumber(value.energy, INITIAL_ENERGY);
  const maxEnergy = Math.max(
    INITIAL_MAX_ENERGY,
    requestedEnergy,
    finiteNumber(value.maxEnergy, INITIAL_MAX_ENERGY),
  );

  return {
    player: sanitizedPlayer(value.player),
    energy: clamp(requestedEnergy, 0, maxEnergy),
    maxEnergy,
    experience: Math.max(0, Math.floor(finiteNumber(value.experience, 0))),
    activeMissionId: requestedActiveMissionId,
    activeMissionCompletedObjectiveIds: stringArray(
      value.activeMissionCompletedObjectiveIds,
    ).filter((id) => allowedObjectiveIds.has(id)),
    completedMissionIds,
    discoveredLocationIds: validLocationIds(value.discoveredLocationIds).filter(
      (id) => unlockedLocationIds.includes(id),
    ),
    unlockedLocationIds,
    specialItemIds: stringArray(value.specialItemIds),
    unlockedStoryIds: stringArray(value.unlockedStoryIds),
    isPaused: value.isPaused === true,
    isFollowingPlayer: value.isFollowingPlayer !== false,
  };
}

function migrateLegacySave(
  value: Record<string, unknown>,
): PersistedGameData | null {
  const hasLegacyData = [
    'telemetry',
    'playerPosition',
    'fuel',
    'energy',
    'experience',
    'completedMissionIds',
    'discoveredLocationIds',
  ].some((key) => key in value);
  if (!hasLegacyData) return null;

  const telemetry = isRecord(value.telemetry) ? value.telemetry : {};
  const position = isRecord(value.playerPosition) ? value.playerPosition : {};
  const legacyPlayer = {
    longitude: telemetry.longitude ?? position.longitude,
    latitude: telemetry.latitude ?? position.latitude,
    heading: telemetry.heading ?? value.heading,
    fuel: telemetry.fuel ?? value.fuel,
    totalDistanceMeters:
      telemetry.totalDistanceMeters ?? value.totalDistanceMeters,
  };

  return sanitizeGame({
    player: legacyPlayer,
    energy: value.energy,
    maxEnergy: value.maxEnergy,
    experience: value.experience,
    activeMissionId: value.activeMissionId,
    activeMissionCompletedObjectiveIds:
      value.activeMissionCompletedObjectiveIds,
    completedMissionIds: value.completedMissionIds,
    discoveredLocationIds: value.discoveredLocationIds,
    unlockedLocationIds: value.unlockedLocationIds,
    specialItemIds: value.specialItemIds,
    unlockedStoryIds: value.unlockedStoryIds,
    isPaused: value.isPaused,
    isFollowingPlayer: value.isFollowingPlayer,
  });
}

export function parseGameSave(raw: string): LoadGameResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid' };
  }
  if (!isRecord(parsed)) return { status: 'invalid' };

  if (parsed.version === GAME_SAVE_VERSION) {
    const game = sanitizeGame(parsed.game);
    if (!game) return { status: 'invalid' };
    return {
      status: 'loaded',
      migrated: false,
      save: {
        version: GAME_SAVE_VERSION,
        savedAt:
          typeof parsed.savedAt === 'string'
            ? parsed.savedAt
            : new Date(0).toISOString(),
        game,
      },
    };
  }

  if (parsed.version === undefined || parsed.version === 0) {
    const game = migrateLegacySave(
      isRecord(parsed.game) ? parsed.game : parsed,
    );
    if (!game) return { status: 'invalid' };
    return {
      status: 'loaded',
      migrated: true,
      save: {
        version: GAME_SAVE_VERSION,
        savedAt: new Date().toISOString(),
        game,
      },
    };
  }

  return { status: 'invalid' };
}

export function browserGameStorage(): GameStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadGameFromStorage(
  storage: GameStorage | null = browserGameStorage(),
): LoadGameResult {
  if (!storage) return { status: 'unavailable' };
  try {
    const raw = storage.getItem(GAME_SAVE_KEY);
    return raw === null ? { status: 'empty' } : parseGameSave(raw);
  } catch {
    return { status: 'unavailable' };
  }
}

export function createGameSave(
  game: PersistedGameData,
  savedAt = new Date().toISOString(),
): GameSaveEnvelope {
  return { version: GAME_SAVE_VERSION, savedAt, game };
}

export function writeGameSave(
  game: PersistedGameData,
  storage: GameStorage | null = browserGameStorage(),
): GameSaveEnvelope | null {
  if (!storage) return null;
  const save = createGameSave(game);
  try {
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(save));
    return save;
  } catch {
    return null;
  }
}

export function clearGameSave(
  storage: GameStorage | null = browserGameStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(GAME_SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

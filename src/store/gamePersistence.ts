import { initiallyUnlockedLocationIds, locations } from '../data/locations';
import { inventoryItemById } from '../data/items';
import { missionById, missions } from '../data/missions';
import { vehicleStateConfig } from '../config/vehicleState.config';
import { addInventoryItem, sanitizeInventory } from '../game/inventory';
import { INITIAL_ENERGY, INITIAL_MAX_ENERGY } from '../game/progression';
import {
  EL_SALVADOR_MOVEMENT_BOUNDS,
  normalizeHeading,
} from '../game/movement';
import type { PlayerRuntime } from '../types/game';
import type {
  CheckpointReason,
  CheckpointSnapshot,
  InventoryEntry,
  MissionObjectiveProgressMap,
  StoryLogEntry,
  VehicleState,
} from '../types/progression';

export const GAME_SAVE_KEY = 'el-salvador-rutas-perdidas:save';
export const GAME_SAVE_VERSION = 4;

export interface PersistedNavigationTarget {
  kind: 'mission-start' | 'location' | 'fuel-station';
  id: string;
}

export interface PersistedGameData {
  player: PlayerRuntime;
  energy: number;
  maxEnergy: number;
  experience: number;
  activeMissionId: string | null;
  activeMissionCompletedObjectiveIds: string[];
  activeMissionObjectiveProgress: MissionObjectiveProgressMap;
  missionChoiceSelections: Record<string, string>;
  storyLogEntries: StoryLogEntry[];
  completedMissionIds: string[];
  discoveredLocationIds: string[];
  unlockedLocationIds: string[];
  specialItemIds: string[];
  unlockedStoryIds: string[];
  inventory: InventoryEntry[];
  vehicle: VehicleState;
  lastCheckpoint: CheckpointSnapshot;
  lastSafeCheckpoint: CheckpointSnapshot;
  currentChapterId: string;
  completedChapterIds: string[];
  roadNetworkVersion: number;
  navigationTarget: PersistedNavigationTarget | null;
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

export function sanitizeCondition(
  value: unknown,
  fieldWasPresent: boolean,
): number {
  if (
    !fieldWasPresent ||
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return vehicleStateConfig.initialCondition;
  }
  return clamp(value, 0, vehicleStateConfig.maximumCondition);
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

function sanitizedNavigationTarget(
  value: unknown,
): PersistedNavigationTarget | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    (value.kind !== 'mission-start' &&
      value.kind !== 'location' &&
      value.kind !== 'fuel-station')
  ) {
    return null;
  }
  return { kind: value.kind, id: value.id };
}

function validMissionChoiceSelections(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([missionId, optionId]) => {
      if (typeof optionId !== 'string') return [];
      const mission = missionById.get(missionId);
      const exists = mission?.objectives.some((objective) =>
        objective.choice?.options.some((option) => option.id === optionId),
      );
      return exists ? [[missionId, optionId]] : [];
    }),
  );
}

function validStoryLogEntries(value: unknown): StoryLogEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry, index) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      seen.has(entry.id) ||
      (entry.type !== 'radio' &&
        entry.type !== 'mission' &&
        entry.type !== 'discovery') ||
      typeof entry.title !== 'string' ||
      typeof entry.summary !== 'string'
    ) {
      return [];
    }
    seen.add(entry.id);
    return [
      {
        id: entry.id,
        type: entry.type,
        title: entry.title,
        summary: entry.summary,
        recordedAt:
          typeof entry.recordedAt === 'string'
            ? entry.recordedAt
            : `Registro ${String(index + 1).padStart(2, '0')}`,
      },
    ];
  });
}

function inventoryEntries(value: unknown): InventoryEntry[] {
  if (!Array.isArray(value)) return [];
  return sanitizeInventory(
    value.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.itemId !== 'string') return [];
      return [
        {
          itemId: entry.itemId,
          quantity: Math.max(0, Math.floor(finiteNumber(entry.quantity, 0))),
        },
      ];
    }),
  );
}

function sanitizedVehicle(value: unknown, fallbackFuel: number): VehicleState {
  const record = isRecord(value) ? value : {};
  const maximumFuel = Math.max(
    1,
    finiteNumber(record.maximumFuel, vehicleStateConfig.initialMaximumFuel),
  );
  return {
    condition: sanitizeCondition(
      record.condition,
      Object.prototype.hasOwnProperty.call(record, 'condition'),
    ),
    fuel: clamp(finiteNumber(record.fuel, fallbackFuel), 0, maximumFuel),
    maximumFuel,
  };
}

function objectiveProgress(
  value: unknown,
  activeMissionId: string | null,
): MissionObjectiveProgressMap {
  if (!isRecord(value) || !activeMissionId) return {};
  const objectiveById = new Map(
    missionById
      .get(activeMissionId)
      ?.objectives.map((objective) => [objective.id, objective]) ?? [],
  );
  return Object.fromEntries(
    Object.entries(value).flatMap(([objectiveId, rawProgress]) => {
      const objective = objectiveById.get(objectiveId);
      if (!objective || !isRecord(rawProgress)) return [];
      const duration =
        rawProgress.durationSeconds === null
          ? null
          : Math.max(1, finiteNumber(rawProgress.durationSeconds, 1));
      const target = Math.max(
        1,
        finiteNumber(rawProgress.target, duration ?? 1),
      );
      return [
        [
          objectiveId,
          {
            value: clamp(finiteNumber(rawProgress.value, 0), 0, target),
            target,
            elapsedSeconds: Math.max(
              0,
              finiteNumber(rawProgress.elapsedSeconds, 0),
            ),
            durationSeconds: duration,
            ...(typeof rawProgress.selectedOptionId === 'string' &&
            objective.choice?.options.some(
              (option) => option.id === rawProgress.selectedOptionId,
            )
              ? { selectedOptionId: rawProgress.selectedOptionId }
              : {}),
          },
        ],
      ];
    }),
  );
}

const checkpointReasons = new Set<CheckpointReason>([
  'new-game',
  'mission-start',
  'city',
  'fuel-station',
  'objective',
  'chapter',
]);

function sanitizedCheckpoint(value: unknown): CheckpointSnapshot | null {
  if (!isRecord(value)) return null;
  const player = sanitizedPlayer(value.player);
  const vehicle = sanitizedVehicle(value.vehicle, player.fuel);
  const activeMissionId =
    typeof value.activeMissionId === 'string' &&
    missionIds.has(value.activeMissionId)
      ? value.activeMissionId
      : null;
  const allowedObjectiveIds = new Set(
    missionById
      .get(activeMissionId ?? '')
      ?.objectives.map((objective) => objective.id) ?? [],
  );
  const reason = checkpointReasons.has(value.reason as CheckpointReason)
    ? (value.reason as CheckpointReason)
    : 'objective';
  return {
    id: typeof value.id === 'string' ? value.id : 'checkpoint-migrated',
    createdAt:
      typeof value.createdAt === 'string'
        ? value.createdAt
        : new Date(0).toISOString(),
    reason,
    player: { ...player, fuel: vehicle.fuel, speedMetersPerSecond: 0 },
    vehicle,
    inventory: inventoryEntries(value.inventory),
    energy: Math.max(0, finiteNumber(value.energy, INITIAL_ENERGY)),
    activeMissionId,
    activeMissionCompletedObjectiveIds: stringArray(
      value.activeMissionCompletedObjectiveIds,
    ).filter((objectiveId) => allowedObjectiveIds.has(objectiveId)),
    activeMissionObjectiveProgress: objectiveProgress(
      value.activeMissionObjectiveProgress,
      activeMissionId,
    ),
    missionChoiceSelections: validMissionChoiceSelections(
      value.missionChoiceSelections,
    ),
  };
}

function sanitizedPlayer(value: unknown): PlayerRuntime {
  const record = isRecord(value) ? value : {};
  const longitude = clamp(
    finiteNumber(record.longitude, -89.1908911),
    EL_SALVADOR_MOVEMENT_BOUNDS.west,
    EL_SALVADOR_MOVEMENT_BOUNDS.east,
  );
  const latitude = clamp(
    finiteNumber(record.latitude, 13.6962937),
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
  const requestedPlayer = sanitizedPlayer(value.player);
  const vehicle = sanitizedVehicle(value.vehicle, requestedPlayer.fuel);
  const player = { ...requestedPlayer, fuel: vehicle.fuel };
  const specialItemIds = stringArray(value.specialItemIds);
  let inventory = inventoryEntries(value.inventory);
  for (const itemId of specialItemIds) {
    if (inventoryItemById.has(itemId)) {
      inventory = addInventoryItem(inventory, itemId, 1);
    }
  }
  const activeMissionObjectiveProgress = objectiveProgress(
    value.activeMissionObjectiveProgress,
    requestedActiveMissionId,
  );
  const fallbackCheckpoint: CheckpointSnapshot = {
    id: 'checkpoint-migrated',
    createdAt: new Date(0).toISOString(),
    reason: 'new-game',
    player: { ...player, speedMetersPerSecond: 0 },
    vehicle,
    inventory,
    energy: clamp(requestedEnergy, 0, maxEnergy),
    activeMissionId: requestedActiveMissionId,
    activeMissionCompletedObjectiveIds: stringArray(
      value.activeMissionCompletedObjectiveIds,
    ).filter((id) => allowedObjectiveIds.has(id)),
    activeMissionObjectiveProgress,
    missionChoiceSelections: validMissionChoiceSelections(
      value.missionChoiceSelections,
    ),
  };
  const lastCheckpoint =
    sanitizedCheckpoint(value.lastCheckpoint) ?? fallbackCheckpoint;
  const lastSafeCheckpoint =
    sanitizedCheckpoint(value.lastSafeCheckpoint) ?? lastCheckpoint;

  return {
    player,
    energy: clamp(requestedEnergy, 0, maxEnergy),
    maxEnergy,
    experience: Math.max(0, Math.floor(finiteNumber(value.experience, 0))),
    activeMissionId: requestedActiveMissionId,
    activeMissionCompletedObjectiveIds: stringArray(
      value.activeMissionCompletedObjectiveIds,
    ).filter((id) => allowedObjectiveIds.has(id)),
    activeMissionObjectiveProgress,
    missionChoiceSelections: validMissionChoiceSelections(
      value.missionChoiceSelections,
    ),
    storyLogEntries: validStoryLogEntries(value.storyLogEntries),
    completedMissionIds,
    discoveredLocationIds: validLocationIds(value.discoveredLocationIds).filter(
      (id) => unlockedLocationIds.includes(id),
    ),
    unlockedLocationIds,
    specialItemIds,
    unlockedStoryIds: stringArray(value.unlockedStoryIds),
    inventory,
    vehicle,
    lastCheckpoint,
    lastSafeCheckpoint,
    currentChapterId:
      typeof value.currentChapterId === 'string'
        ? value.currentChapterId
        : 'chapter-1',
    completedChapterIds: stringArray(value.completedChapterIds),
    roadNetworkVersion: Math.max(
      1,
      Math.floor(finiteNumber(value.roadNetworkVersion, 1)),
    ),
    navigationTarget: sanitizedNavigationTarget(value.navigationTarget),
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

  return sanitizeGame(
    expandVersionOneChapterProgress({
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
    }),
  );
}

function expandVersionOneChapterProgress(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const completedMissionIds = stringArray(value.completedMissionIds);
  const activeMissionId =
    typeof value.activeMissionId === 'string' ? value.activeMissionId : null;
  const reachedSantaAna =
    completedMissionIds.includes('camino-hacia-santa-ana') ||
    completedMissionIds.includes('secreto-de-coatepeque') ||
    activeMissionId === 'secreto-de-coatepeque';
  const additions = reachedSantaAna
    ? [
        'la-transmision',
        'estacion-abandonada',
        'reparacion-de-emergencia',
        'llegada-a-santa-ana',
      ]
    : activeMissionId === 'camino-hacia-santa-ana'
      ? ['la-transmision']
      : [];
  return {
    ...value,
    completedMissionIds: [...new Set([...completedMissionIds, ...additions])],
  };
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

  if (
    parsed.version === 1 ||
    parsed.version === 2 ||
    parsed.version === 3
  ) {
    const game = sanitizeGame(
      parsed.version === 1
        ? expandVersionOneChapterProgress(parsed.game)
        : parsed.game,
    );
    if (!game) return { status: 'invalid' };
    return {
      status: 'loaded',
      migrated: true,
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

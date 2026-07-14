import { describe, expect, it } from 'vitest';
import {
  createGameSave,
  GAME_SAVE_KEY,
  GAME_SAVE_VERSION,
  loadGameFromStorage,
  parseGameSave,
  type GameStorage,
  type PersistedGameData,
  writeGameSave,
} from '../src/store/gamePersistence';

class MemoryStorage implements GameStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const game: PersistedGameData = {
  player: {
    longitude: -89.3,
    latitude: 13.8,
    heading: 45,
    speedMetersPerSecond: 20,
    fuel: 72,
    totalDistanceMeters: 12_500,
  },
  energy: 90,
  maxEnergy: 120,
  experience: 650,
  activeMissionId: 'secreto-de-coatepeque',
  activeMissionCompletedObjectiveIds: ['mirador-norte'],
  activeMissionObjectiveProgress: {
    'mirador-norte': {
      value: 1,
      target: 1,
      elapsedSeconds: 0,
      durationSeconds: null,
    },
  },
  completedMissionIds: [
    'la-transmision',
    'camino-hacia-santa-ana',
    'estacion-abandonada',
    'reparacion-de-emergencia',
    'llegada-a-santa-ana',
  ],
  discoveredLocationIds: ['san-salvador'],
  unlockedLocationIds: ['san-salvador', 'volcan-santa-ana'],
  specialItemIds: [],
  unlockedStoryIds: [],
  inventory: [],
  vehicle: {
    condition: 84,
    fuel: 72,
    maximumFuel: 100,
  },
  lastCheckpoint: {
    id: 'checkpoint-test',
    createdAt: '2026-07-13T00:00:00.000Z',
    reason: 'objective',
    player: {
      longitude: -89.3,
      latitude: 13.8,
      heading: 45,
      speedMetersPerSecond: 0,
      fuel: 72,
      totalDistanceMeters: 12_500,
    },
    vehicle: {
      condition: 84,
      fuel: 72,
      maximumFuel: 100,
    },
    inventory: [],
    energy: 90,
    activeMissionId: 'secreto-de-coatepeque',
    activeMissionCompletedObjectiveIds: ['mirador-norte'],
    activeMissionObjectiveProgress: {
      'mirador-norte': {
        value: 1,
        target: 1,
        elapsedSeconds: 0,
        durationSeconds: null,
      },
    },
  },
  lastSafeCheckpoint: {
    id: 'checkpoint-safe-test',
    createdAt: '2026-07-13T00:00:00.000Z',
    reason: 'city',
    player: {
      longitude: -89.3,
      latitude: 13.8,
      heading: 45,
      speedMetersPerSecond: 0,
      fuel: 72,
      totalDistanceMeters: 12_500,
    },
    vehicle: {
      condition: 84,
      fuel: 72,
      maximumFuel: 100,
    },
    inventory: [],
    energy: 90,
    activeMissionId: null,
    activeMissionCompletedObjectiveIds: [],
    activeMissionObjectiveProgress: {},
  },
  currentChapterId: 'chapter-1',
  completedChapterIds: [],
  roadNetworkVersion: 1,
  isPaused: false,
  isFollowingPlayer: true,
};

describe('guardado versionado', () => {
  it('escribe y recupera una partida válida', () => {
    const storage = new MemoryStorage();
    const written = writeGameSave(game, storage);
    const loaded = loadGameFromStorage(storage);

    expect(written?.version).toBe(GAME_SAVE_VERSION);
    expect(storage.getItem(GAME_SAVE_KEY)).not.toBeNull();
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') {
      expect(loaded.migrated).toBe(false);
      expect(loaded.save.game.player.longitude).toBe(-89.3);
      expect(loaded.save.game.player.speedMetersPerSecond).toBe(0);
      expect(loaded.save.game.activeMissionCompletedObjectiveIds).toEqual([
        'mirador-norte',
      ]);
    }
  });

  it('migra el estado plano anterior a la versión actual', () => {
    const legacy = JSON.stringify({
      playerPosition: { longitude: -89.2, latitude: 13.7 },
      heading: 370,
      fuel: 45,
      energy: 70,
      experience: 250,
      completedMissionIds: ['camino-hacia-santa-ana'],
      unlockedLocationIds: ['volcan-santa-ana'],
    });
    const result = parseGameSave(legacy);

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.migrated).toBe(true);
      expect(result.save.game.player.heading).toBe(10);
      expect(result.save.game.player.fuel).toBe(45);
      expect(result.save.game.unlockedLocationIds).toContain('san-salvador');
      expect(result.save.game.unlockedLocationIds).toContain(
        'volcan-santa-ana',
      );
      expect(result.save.game.inventory).toEqual([]);
      expect(result.save.game.vehicle.condition).toBe(100);
      expect(result.save.game.lastCheckpoint.reason).toBe('new-game');
      expect(result.save.game.currentChapterId).toBe('chapter-1');
      expect(result.save.game.roadNetworkVersion).toBe(1);
    }
  });

  it('migra una partida v1 sin perder el progreso existente', () => {
    const versionOneGame = {
      player: game.player,
      energy: game.energy,
      maxEnergy: game.maxEnergy,
      experience: game.experience,
      activeMissionId: game.activeMissionId,
      activeMissionCompletedObjectiveIds:
        game.activeMissionCompletedObjectiveIds,
      completedMissionIds: ['camino-hacia-santa-ana'],
      discoveredLocationIds: game.discoveredLocationIds,
      unlockedLocationIds: game.unlockedLocationIds,
      specialItemIds: ['fragmento-de-caldera'],
      unlockedStoryIds: ['eco-del-embalse'],
      isPaused: false,
      isFollowingPlayer: true,
    };
    const result = parseGameSave(
      JSON.stringify({
        version: 1,
        savedAt: '2026-01-01T00:00:00.000Z',
        game: versionOneGame,
      }),
    );

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.migrated).toBe(true);
      expect(result.save.game.player.longitude).toBe(game.player.longitude);
      expect(result.save.game.experience).toBe(game.experience);
      expect(result.save.game.completedMissionIds).toEqual([
        'camino-hacia-santa-ana',
        'la-transmision',
        'estacion-abandonada',
        'reparacion-de-emergencia',
        'llegada-a-santa-ana',
      ]);
      expect(result.save.game.unlockedStoryIds).toEqual(['eco-del-embalse']);
      expect(result.save.game.inventory).toEqual([
        { itemId: 'fragmento-de-caldera', quantity: 1 },
      ]);
      expect(result.save.game.vehicle.condition).toBe(100);
      expect(result.save.game.lastCheckpoint.activeMissionId).toBe(
        game.activeMissionId,
      );
    }
  });

  it('sanea límites y descarta referencias desconocidas', () => {
    const unsafe = createGameSave({
      ...game,
      player: {
        ...game.player,
        longitude: 500,
        latitude: -200,
        fuel: 400,
        totalDistanceMeters: -5,
      },
      vehicle: {
        condition: -20,
        fuel: 400,
        maximumFuel: 100,
      },
      activeMissionId: 'mision-inexistente',
      completedMissionIds: ['mision-inexistente'],
      discoveredLocationIds: ['sitio-inexistente'],
      unlockedLocationIds: ['sitio-inexistente'],
    });
    const result = parseGameSave(JSON.stringify(unsafe));

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.save.game.player.longitude).toBe(-87.65);
      expect(result.save.game.player.latitude).toBe(13);
      expect(result.save.game.player.fuel).toBe(100);
      expect(result.save.game.vehicle.condition).toBe(0);
      expect(result.save.game.player.totalDistanceMeters).toBe(0);
      expect(result.save.game.activeMissionId).toBeNull();
      expect(result.save.game.completedMissionIds).toEqual([]);
      expect(result.save.game.discoveredLocationIds).toEqual([]);
    }
  });

  it('rechaza JSON roto y versiones futuras desconocidas', () => {
    expect(parseGameSave('{no-json').status).toBe('invalid');
    expect(parseGameSave('{}').status).toBe('invalid');
    expect(parseGameSave(JSON.stringify({ version: 99, game })).status).toBe(
      'invalid',
    );
  });
});

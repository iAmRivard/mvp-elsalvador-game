import { describe, expect, it } from 'vitest';
import {
  createGameSave,
  GAME_SAVE_KEY,
  GAME_SAVE_VERSION,
  loadGameFromStorage,
  parseGameSave,
  sanitizeCondition,
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
  onboardingState: 'completed',
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
  missionChoiceSelections: {},
  storyLogEntries: [],
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
  selectedVehicleId: 'torogoz',
  selectedVehicleSkinId: 'torogoz-cyan',
  unlockedVehicleIds: ['torogoz'],
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
    missionChoiceSelections: {},
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
    missionChoiceSelections: {},
  },
  currentChapterId: 'chapter-1',
  completedChapterIds: [],
  roadNetworkVersion: 1,
  navigationTarget: null,
  isPaused: false,
  isFollowingPlayer: true,
};

describe('guardado versionado', () => {
  it('distingue condición ausente, inválida y cero válido', () => {
    expect(sanitizeCondition(undefined, false)).toBe(100);
    expect(sanitizeCondition(Number.NaN, true)).toBe(100);
    expect(sanitizeCondition(Number.POSITIVE_INFINITY, true)).toBe(100);
    expect(sanitizeCondition('0', true)).toBe(100);
    expect(sanitizeCondition(0, true)).toBe(0);
    expect(sanitizeCondition(-8, true)).toBe(0);
    expect(sanitizeCondition(140, true)).toBe(100);
  });

  it('migra una condición ausente a 100 y conserva un cero válido', () => {
    const withoutCondition = JSON.parse(
      JSON.stringify(createGameSave(game)),
    ) as { game: { vehicle: Record<string, unknown> } };
    delete withoutCondition.game.vehicle.condition;
    const missingResult = parseGameSave(JSON.stringify(withoutCondition));
    const zeroResult = parseGameSave(
      JSON.stringify(
        createGameSave({
          ...game,
          vehicle: { ...game.vehicle, condition: 0 },
        }),
      ),
    );

    expect(missingResult.status).toBe('loaded');
    expect(zeroResult.status).toBe('loaded');
    if (missingResult.status === 'loaded') {
      expect(missingResult.save.game.vehicle.condition).toBe(100);
    }
    if (zeroResult.status === 'loaded') {
      expect(zeroResult.save.game.vehicle.condition).toBe(0);
    }
  });

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

  it('persiste elecciones y entradas de bitácora', () => {
    const result = parseGameSave(
      JSON.stringify(
        createGameSave({
          ...game,
          missionChoiceSelections: { 'camino-hacia-santa-ana': 'north' },
          storyLogEntries: [
            {
              id: 'choice:camino-hacia-santa-ana',
              type: 'mission',
              title: 'Ruta elegida: Ruta norte',
              summary: 'Trayecto estable.',
              recordedAt: 'Registro 01',
            },
          ],
        }),
      ),
    );

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.save.game.missionChoiceSelections).toEqual({
        'camino-hacia-santa-ana': 'north',
      });
      expect(result.save.game.storyLogEntries).toHaveLength(1);
    }
  });

  it('persiste únicamente la identidad del destino temporal', () => {
    const result = parseGameSave(
      JSON.stringify(
        createGameSave({
          ...game,
          navigationTarget: {
            kind: 'fuel-station',
            id: 'abastecimiento-san-salvador',
          },
        }),
      ),
    );

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.save.game.navigationTarget).toEqual({
        kind: 'fuel-station',
        id: 'abastecimiento-san-salvador',
      });
    }
  });

  it('migra v3 sin destino y descarta destinos mal formados', () => {
    const versionThree = createGameSave(game) as unknown as {
      version: number;
      game: Record<string, unknown>;
    };
    versionThree.version = 3;
    delete versionThree.game.navigationTarget;
    const migrated = parseGameSave(JSON.stringify(versionThree));
    const malformed = parseGameSave(
      JSON.stringify(
        createGameSave({
          ...game,
          navigationTarget: {
            kind: 'fuel-station',
            id: 'abastecimiento-san-salvador',
          },
        }),
      ).replace('"kind":"fuel-station"', '"kind":"external"'),
    );

    expect(migrated.status).toBe('loaded');
    if (migrated.status === 'loaded') {
      expect(migrated.migrated).toBe(true);
      expect(migrated.save.game.navigationTarget).toBeNull();
    }
    expect(malformed.status).toBe('loaded');
    if (malformed.status === 'loaded') {
      expect(malformed.save.game.navigationTarget).toBeNull();
    }
  });

  it('migra v2 sin modificar el combustible existente', () => {
    const versionTwo = createGameSave({
      ...game,
      player: { ...game.player, fuel: 33 },
      vehicle: { ...game.vehicle, fuel: 33 },
    }) as unknown as { version: number; game: Record<string, unknown> };
    versionTwo.version = 2;
    delete versionTwo.game.missionChoiceSelections;
    delete versionTwo.game.storyLogEntries;
    const result = parseGameSave(JSON.stringify(versionTwo));

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.migrated).toBe(true);
      expect(result.save.game.player.fuel).toBe(33);
      expect(result.save.game.vehicle.fuel).toBe(33);
      expect(result.save.game.missionChoiceSelections).toEqual({});
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

  it('migra una partida v4 como onboarding ya resuelto', () => {
    const legacyGame = { ...game } as Record<string, unknown>;
    delete legacyGame.onboardingState;
    const result = parseGameSave(
      JSON.stringify({
        version: 4,
        savedAt: '2026-07-14T00:00:00.000Z',
        game: legacyGame,
      }),
    );

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.migrated).toBe(true);
      expect(result.save.version).toBe(GAME_SAVE_VERSION);
      expect(result.save.game.onboardingState).toBe('completed');
    }
  });

  it.each([1, 2, 3, 4, 5])(
    'migra una partida v%i al loadout v6 sin perder progreso',
    (version) => {
      const legacy = createGameSave(game) as unknown as {
        version: number;
        game: Record<string, unknown>;
      };
      legacy.version = version;
      delete legacy.game.selectedVehicleId;
      delete legacy.game.selectedVehicleSkinId;
      delete legacy.game.unlockedVehicleIds;
      const result = parseGameSave(JSON.stringify(legacy));

      expect(result.status).toBe('loaded');
      if (result.status === 'loaded') {
        expect(result.migrated).toBe(true);
        expect(result.save.version).toBe(6);
        expect(result.save.game.selectedVehicleId).toBe('torogoz');
        expect(result.save.game.selectedVehicleSkinId).toBe('torogoz-cyan');
        expect(result.save.game.unlockedVehicleIds).toEqual([
          'torogoz',
          'volcan-gt',
        ]);
        expect(result.save.game.experience).toBe(game.experience);
      }
    },
  );

  it('sanea IDs desconocidos, selección bloqueada y skin incompatible', () => {
    const unsafe = createGameSave(game) as unknown as {
      version: number;
      game: Record<string, unknown>;
    };
    unsafe.version = 6;
    unsafe.game.completedMissionIds = [];
    unsafe.game.unlockedVehicleIds = ['desconocido', 'torogoz', 'torogoz'];
    unsafe.game.selectedVehicleId = 'coyote-4x4';
    unsafe.game.selectedVehicleSkinId = 'volcan-crimson';
    const result = parseGameSave(JSON.stringify(unsafe));

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.migrated).toBe(false);
      expect(result.save.game.unlockedVehicleIds).toEqual(['torogoz']);
      expect(result.save.game.selectedVehicleId).toBe('torogoz');
      expect(result.save.game.selectedVehicleSkinId).toBe('torogoz-cyan');
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

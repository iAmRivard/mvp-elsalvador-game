// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_SAVE_KEY } from '../src/store/gamePersistence';
import { INITIAL_PLAYER, useGameStore } from '../src/store/gameStore';

describe('acciones de guardado del estado global', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it('guarda y vuelve a cargar posición, combustible y misión activa', () => {
    useGameStore.getState().startMission('la-transmision');
    useGameStore.getState().dismissNarrativeEvent();
    useGameStore.getState().setTelemetry({
      ...INITIAL_PLAYER,
      longitude: -89.25,
      latitude: 13.75,
      fuel: 63,
      totalDistanceMeters: 8_200,
    });
    expect(useGameStore.getState().saveGame()).toBe(true);

    useGameStore.getState().setTelemetry({ ...INITIAL_PLAYER, fuel: 10 });
    useGameStore.getState().abandonMission();
    const previousRevision = useGameStore.getState().playerRuntimeRevision;
    expect(useGameStore.getState().loadGame()).toBe(true);

    const state = useGameStore.getState();
    expect(state.telemetry.longitude).toBe(-89.25);
    expect(state.telemetry.latitude).toBe(13.75);
    expect(state.telemetry.fuel).toBe(63);
    expect(state.telemetry.totalDistanceMeters).toBe(8_200);
    expect(state.activeMissionId).toBe('la-transmision');
    expect(state.playerRuntimeRevision).toBe(previousRevision + 1);
  });

  it('reinicia todos los datos y elimina el guardado anterior', () => {
    useGameStore.getState().addExperience(950);
    useGameStore.getState().saveGame();
    expect(window.localStorage.getItem(GAME_SAVE_KEY)).not.toBeNull();

    useGameStore.getState().resetGame();
    const state = useGameStore.getState();
    expect(state.experience).toBe(0);
    expect(state.level).toBe(1);
    expect(state.telemetry.longitude).toBe(INITIAL_PLAYER.longitude);
    expect(state.completedMissionIds).toEqual([]);
    expect(window.localStorage.getItem(GAME_SAVE_KEY)).toBeNull();
  });

  it('activa recuperación al cargar una condición cero válida', () => {
    useGameStore.setState({
      experience: 650,
      inventory: [{ itemId: 'bidon-combustible', quantity: 2 }],
      vehicle: { ...useGameStore.getState().vehicle, condition: 0 },
    });
    expect(useGameStore.getState().saveGame()).toBe(true);

    useGameStore.setState({
      experience: 0,
      inventory: [],
      vehicle: { ...useGameStore.getState().vehicle, condition: 70 },
      recoveryReason: null,
      isPaused: false,
    });
    expect(useGameStore.getState().loadGame()).toBe(true);

    expect(useGameStore.getState()).toMatchObject({
      experience: 650,
      inventory: [{ itemId: 'bidon-combustible', quantity: 2 }],
      vehicle: { condition: 0 },
      recoveryReason: 'condition',
      isPaused: true,
      needsInitialRoadAlignment: false,
    });
  });

  it('migra una partida sin condición sin abrir recuperación', () => {
    useGameStore.getState().addExperience(200);
    expect(useGameStore.getState().saveGame()).toBe(true);
    const envelope = JSON.parse(
      window.localStorage.getItem(GAME_SAVE_KEY)!,
    ) as { game: { vehicle: Record<string, unknown> } };
    delete envelope.game.vehicle.condition;
    window.localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(envelope));

    expect(useGameStore.getState().loadGame()).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      experience: 200,
      vehicle: { condition: 100 },
      recoveryReason: null,
    });
  });
});

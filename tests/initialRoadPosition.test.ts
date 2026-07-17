import { beforeEach, describe, expect, it } from 'vitest';
import { alignedRoadHeading } from '../src/roads/initialRoadPosition';
import { useGameStore } from '../src/store/gameStore';

describe('posición inicial segura', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useGameStore.setState({ needsInitialRoadAlignment: true });
  });

  it('elige el sentido compatible de una vía bidireccional', () => {
    expect(alignedRoadHeading(350, 10, false)).toBe(10);
    expect(alignedRoadHeading(190, 10, false)).toBe(190);
    expect(alignedRoadHeading(190, 10, true)).toBe(10);
  });

  it('alinea una partida nueva y actualiza su checkpoint inicial', () => {
    expect(
      useGameStore
        .getState()
        .alignInitialPlayerToRoad([-89.1907, 13.6965], 82, 18),
    ).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      telemetry: { longitude: -89.1907, latitude: 13.6965, heading: 82 },
      lastCheckpoint: {
        reason: 'new-game',
        player: { longitude: -89.1907, latitude: 13.6965, heading: 82 },
      },
      needsInitialRoadAlignment: false,
    });
  });

  it('valida sin mover una posicion que ya esta dentro del corredor vial', () => {
    const initial = useGameStore.getState().telemetry;
    useGameStore.setState({ hasSavedGame: true });

    expect(
      useGameStore.getState().alignInitialPlayerToRoad([-89, 14], 90, 3),
    ).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      telemetry: initial,
      needsInitialRoadAlignment: false,
      playerRuntimeRevision: 0,
    });
  });

  it('corrige un guardado fuera del corredor sin reemplazar sus checkpoints', () => {
    const checkpoint = useGameStore.getState().lastSafeCheckpoint;
    useGameStore.setState({ hasSavedGame: true });

    expect(
      useGameStore
        .getState()
        .alignInitialPlayerToRoad([-89.1907, 13.6965], 82, 24),
    ).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      telemetry: { longitude: -89.1907, latitude: 13.6965, heading: 82 },
      lastCheckpoint: checkpoint,
      lastSafeCheckpoint: checkpoint,
      needsInitialRoadAlignment: false,
      playerRuntimeRevision: 1,
    });
  });

  it('no mueve una partida existente', () => {
    const initialLongitude = useGameStore.getState().telemetry.longitude;
    useGameStore.setState({ needsInitialRoadAlignment: false });
    expect(
      useGameStore.getState().alignInitialPlayerToRoad([-89, 14], 90, 20),
    ).toBe(false);
    expect(useGameStore.getState().telemetry.longitude).toBe(initialLongitude);
  });

  it('acepta la posicion runtime sin moverla cuando ya se condujo en fallback', () => {
    const telemetry = {
      ...useGameStore.getState().telemetry,
      longitude: -89.2,
      latitude: 13.7,
      heading: 143,
      speedMetersPerSecond: 8,
      speedKilometersPerHour: 28.8,
      totalDistanceMeters: 42,
    };
    useGameStore.setState({ telemetry, playerRuntimeRevision: 7 });

    useGameStore.getState().acceptCurrentPlayerRoadPosition();

    expect(useGameStore.getState()).toMatchObject({
      telemetry,
      needsInitialRoadAlignment: false,
      playerRuntimeRevision: 7,
    });
  });
});

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
      useGameStore.getState().alignInitialPlayerToRoad([-89.1907, 13.6965], 82),
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

  it('no mueve una partida existente', () => {
    const initialLongitude = useGameStore.getState().telemetry.longitude;
    useGameStore.setState({ needsInitialRoadAlignment: false });
    expect(
      useGameStore.getState().alignInitialPlayerToRoad([-89, 14], 90),
    ).toBe(false);
    expect(useGameStore.getState().telemetry.longitude).toBe(initialLongitude);
  });
});

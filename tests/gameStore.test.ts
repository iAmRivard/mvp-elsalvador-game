import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../src/store/gameStore';

describe('estado de misiones', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it('inicia, abandona y reinicia el progreso de una misión', () => {
    expect(useGameStore.getState().startMission('camino-hacia-santa-ana')).toBe(
      true,
    );
    expect(useGameStore.getState().activeMissionId).toBe(
      'camino-hacia-santa-ana',
    );

    useGameStore.getState().abandonMission();
    expect(useGameStore.getState().activeMissionId).toBeNull();
    expect(useGameStore.getState().activeMissionCompletedObjectiveIds).toEqual(
      [],
    );
  });

  it('completa la misión y entrega experiencia, combustible y desbloqueo', () => {
    useGameStore.getState().startMission('camino-hacia-santa-ana');
    const completion = useGameStore.getState().advanceActiveMission(
      {
        longitude: -89.556667,
        latitude: 13.994722,
        heading: 0,
        speedMetersPerSecond: 0,
        fuel: 25,
        totalDistanceMeters: 50_000,
      },
      false,
    );
    const state = useGameStore.getState();

    expect(completion).toEqual({
      missionId: 'camino-hacia-santa-ana',
      fuelReward: 30,
    });
    expect(state.activeMissionId).toBeNull();
    expect(state.completedMissionIds).toContain('camino-hacia-santa-ana');
    expect(state.experience).toBe(250);
    expect(state.level).toBe(2);
    expect(state.lastLevelUp).toBe(2);
    expect(state.telemetry.fuel).toBe(55);
    expect(state.unlockedLocationIds).toContain('volcan-santa-ana');

    useGameStore.getState().dismissLevelUp();
    expect(useGameStore.getState().lastLevelUp).toBeNull();
  });
});

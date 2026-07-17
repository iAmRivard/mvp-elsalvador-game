import { describe, expect, it } from 'vitest';
import { runtimeGateFor } from '../src/game/runtimeGate';

describe('runtime gate', () => {
  it.each([
    ['startup', { startupReady: false }, false, false, false],
    ['fatal-map', { fatalMapError: true }, false, false, false],
    ['pause', { paused: true }, false, false, false],
    ['journal', { journalOpen: true }, false, false, true],
    ['narrative', { narrativeActive: true }, false, false, false],
    ['mission-choice', { missionChoiceActive: true }, false, false, false],
    ['recovery', { recoveryActive: true }, false, false, false],
    ['vehicle-disabled', { vehicleEnabled: false }, false, false, false],
  ] as const)(
    'expone %s como causa coherente',
    (
      blockedBy,
      override,
      simulationEnabled,
      drivingInputEnabled,
      missionClockEnabled,
    ) => {
      expect(
        runtimeGateFor({
          startupReady: true,
          fatalMapError: false,
          paused: false,
          journalOpen: false,
          narrativeActive: false,
          missionChoiceActive: false,
          recoveryActive: false,
          vehicleEnabled: true,
          ...override,
        }),
      ).toEqual({
        simulationEnabled,
        drivingInputEnabled,
        missionClockEnabled,
        blockedBy,
      });
    },
  );

  it('habilita juego normal y tutorial cuando el runtime está listo', () => {
    expect(
      runtimeGateFor({
        startupReady: true,
        fatalMapError: false,
        paused: false,
        journalOpen: false,
        narrativeActive: false,
        missionChoiceActive: false,
        recoveryActive: false,
        vehicleEnabled: true,
      }),
    ).toEqual({
      simulationEnabled: true,
      drivingInputEnabled: true,
      missionClockEnabled: true,
      blockedBy: null,
    });
  });
});

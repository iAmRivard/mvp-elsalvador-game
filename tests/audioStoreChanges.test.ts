import { describe, expect, it } from 'vitest';
import {
  adaptiveMusicStateChanged,
  vehicleAudioStateChanged,
} from '../src/audio/audioStoreChanges';
import { useGameStore } from '../src/store/gameStore';

describe('fanout de audio desde Zustand', () => {
  it('ignora escrituras de condiciÃ³n que no cambian el sonido del vehÃ­culo', () => {
    const state = useGameStore.getInitialState();
    const conditionOnly = {
      ...state,
      vehicle: { ...state.vehicle, condition: state.vehicle.condition - 1 },
    };

    expect(vehicleAudioStateChanged(conditionOnly, state)).toBe(false);
    expect(adaptiveMusicStateChanged(conditionOnly, state)).toBe(false);
  });

  it('actualiza el vehÃ­culo por velocidad, superficie, pausa o selecciÃ³n', () => {
    const state = useGameStore.getInitialState();

    expect(
      vehicleAudioStateChanged(
        {
          ...state,
          telemetry: { ...state.telemetry, speedMetersPerSecond: 4 },
        },
        state,
      ),
    ).toBe(true);
    expect(
      vehicleAudioStateChanged(
        { ...state, driving: { ...state.driving, surface: 'offroad' } },
        state,
      ),
    ).toBe(true);
    expect(vehicleAudioStateChanged({ ...state, isPaused: true }, state)).toBe(
      true,
    );
  });

  it('actualiza mÃºsica por reloj, radio o progreso de misiÃ³n', () => {
    const state = useGameStore.getInitialState();

    expect(
      adaptiveMusicStateChanged(
        { ...state, missionTimerCountdownSeconds: 3 },
        state,
      ),
    ).toBe(true);
    expect(
      adaptiveMusicStateChanged(
        { ...state, activeRadioEventId: 'radio-prueba' },
        state,
      ),
    ).toBe(true);
    expect(
      adaptiveMusicStateChanged(
        {
          ...state,
          activeMissionCompletedObjectiveIds: ['objetivo-prueba'],
        },
        state,
      ),
    ).toBe(true);
  });
});

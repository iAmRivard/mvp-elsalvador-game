// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_PLAYER, useGameStore } from '../src/store/gameStore';

function enterFastPresentation() {
  useGameStore.getState().setTelemetry({
    ...INITIAL_PLAYER,
    speedMetersPerSecond: 20,
    fuel: 75,
  });
  expect(useGameStore.getState().presentationMode).toBe('fast');
}

describe('presentación central del store', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it('sale de fast inmediatamente al abrir y cerrar la bitácora', () => {
    enterFastPresentation();
    useGameStore.getState().openJournal('missions');
    expect(useGameStore.getState().presentationMode).toBe('alert');

    useGameStore.getState().closeJournal();
    expect(useGameStore.getState().presentationMode).toBe('fast');
  });

  it.each([
    { recoveryReason: 'fuel' as const },
    { activeNarrativeEventId: 'narrativa-prueba' },
    { activeMissionChoiceObjectiveId: 'eleccion-prueba' },
  ])('sale de fast con un bloqueo global: %o', (blockingState) => {
    enterFastPresentation();
    useGameStore.setState(blockingState);
    expect(useGameStore.getState().presentationMode).toBe('alert');
  });

  it('sale de alert en el mismo cambio que repone combustible', () => {
    enterFastPresentation();
    useGameStore.getState().setTelemetry({
      ...INITIAL_PLAYER,
      speedMetersPerSecond: 20,
      fuel: 19,
    });
    expect(useGameStore.getState().presentationMode).toBe('alert');

    useGameStore.getState().restoreFuel(30);
    expect(useGameStore.getState().presentationMode).toBe('fast');
  });

  it('realinea la histéresis al restablecer el store', () => {
    enterFastPresentation();

    useGameStore.setState(useGameStore.getInitialState(), true);

    expect(useGameStore.getState().presentationMode).toBe('stopped');
    useGameStore.getState().setTelemetry({
      ...INITIAL_PLAYER,
      speedMetersPerSecond: -1,
      fuel: 75,
    });
    expect(useGameStore.getState().presentationMode).toBe('stopped');
  });
});

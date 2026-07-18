import { describe, expect, it } from 'vitest';
import {
  deriveDrivingPresentationMode,
  derivePresentationFromState,
  DrivingPresentationController,
  effectiveDrivingSurfaceLabel,
  type DrivingPresentationInput,
  type PresentationRelevantState,
} from '../src/game/drivingPresentation';

const baseInput: DrivingPresentationInput = {
  speedKilometersPerHour: 0,
  hasCriticalFuelAlert: false,
  hasCriticalConditionAlert: false,
  hasInteraction: false,
  isPaused: false,
  isJournalOpen: false,
  activeBlockingOverlay: false,
};

describe('presentación de conducción', () => {
  it('prioriza alerta e interacción sobre velocidad', () => {
    expect(
      deriveDrivingPresentationMode({
        ...baseInput,
        speedKilometersPerHour: 80,
        hasCriticalFuelAlert: true,
      }),
    ).toBe('alert');
    expect(
      deriveDrivingPresentationMode({ ...baseInput, hasInteraction: true }),
    ).toBe('interaction');
  });

  it('separa conducción y alta velocidad con histéresis', () => {
    expect(
      deriveDrivingPresentationMode({
        ...baseInput,
        speedKilometersPerHour: 57.99,
        previousMode: 'driving',
        stoppedForMilliseconds: 0,
      }),
    ).toBe('driving');
    expect(
      deriveDrivingPresentationMode({
        ...baseInput,
        speedKilometersPerHour: 58,
        previousMode: 'driving',
        stoppedForMilliseconds: 0,
      }),
    ).toBe('fast');
    expect(
      deriveDrivingPresentationMode({
        ...baseInput,
        speedKilometersPerHour: 58.01,
        previousMode: 'driving',
        stoppedForMilliseconds: 0,
      }),
    ).toBe('fast');
    expect(
      deriveDrivingPresentationMode({
        ...baseInput,
        speedKilometersPerHour: 54,
        previousMode: 'fast',
        stoppedForMilliseconds: 0,
      }),
    ).toBe('fast');
    expect(
      deriveDrivingPresentationMode({
        ...baseInput,
        speedKilometersPerHour: 52,
        previousMode: 'fast',
        stoppedForMilliseconds: 0,
      }),
    ).toBe('driving');
  });

  it('espera 1.25 segundos antes de volver a detenido', () => {
    const controller = new DrivingPresentationController();
    expect(controller.update(baseInput, 0)).toBe('stopped');
    expect(
      controller.update({ ...baseInput, speedKilometersPerHour: 20 }, 1),
    ).toBe('driving');
    expect(controller.update(baseInput, 100)).toBe('driving');
    expect(controller.update(baseInput, 1_349)).toBe('driving');
    expect(controller.update(baseInput, 1_350)).toBe('stopped');
  });
});

describe('derivaciÃ³n central de presentaciÃ³n', () => {
  const moving: PresentationRelevantState = {
    speedKilometersPerHour: 72,
    isPaused: false,
    isJournalOpen: false,
    recoveryReason: null,
    activeNarrativeEventId: null,
    activeMissionChoiceObjectiveId: null,
    hasCriticalFuelAlert: false,
    hasCriticalConditionAlert: false,
    hasCriticalTimerAlert: false,
    hasInteraction: false,
  };

  it('reacciona a cada estado bloqueante sin esperar telemetrÃ­a', () => {
    const derive = (override: Partial<PresentationRelevantState>) =>
      derivePresentationFromState({ ...moving, ...override }, 'fast', 100);

    expect(derive({ isJournalOpen: true })).toBe('alert');
    expect(derive({ activeNarrativeEventId: 'radio-1' })).toBe('alert');
    expect(derive({ activeMissionChoiceObjectiveId: 'choice-1' })).toBe(
      'alert',
    );
    expect(derive({ recoveryReason: 'fuel' })).toBe('alert');
    expect(derive({ hasCriticalFuelAlert: true })).toBe('alert');
    expect(derive({ hasCriticalConditionAlert: true })).toBe('alert');
    expect(derive({ hasCriticalTimerAlert: true })).toBe('alert');
    expect(derive({ isPaused: true, speedKilometersPerHour: 0 })).toBe(
      'stopped',
    );
  });

  it('sale de alertas, interacciones, bitÃ¡cora y pausa con el estado actual', () => {
    const cruising = { ...moving, speedKilometersPerHour: 30 };
    expect(derivePresentationFromState(cruising, 'alert', 200)).toBe('driving');
    expect(
      derivePresentationFromState(
        { ...cruising, speedKilometersPerHour: 0, hasInteraction: true },
        'alert',
        200,
      ),
    ).toBe('interaction');
    expect(
      derivePresentationFromState(
        { ...cruising, speedKilometersPerHour: 0 },
        'interaction',
        200,
      ),
    ).toBe('stopped');
  });

  it('sustituye solo la etiqueta visual dentro de una zona de objetivo', () => {
    expect(effectiveDrivingSurfaceLabel('offroad', true)).toBe(
      'Zona del objetivo',
    );
    expect(effectiveDrivingSurfaceLabel('offroad', false)).toBe(
      'Fuera de carretera',
    );
    expect(effectiveDrivingSurfaceLabel('primary', false)).toBe(
      'V\u00eda primaria',
    );
  });
});

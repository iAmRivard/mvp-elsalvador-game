import { describe, expect, it } from 'vitest';
import {
  deriveDrivingPresentationMode,
  DrivingPresentationController,
  type DrivingPresentationInput,
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
        speedKilometersPerHour: 57,
        previousMode: 'driving',
        stoppedForMilliseconds: 0,
      }),
    ).toBe('driving');
    expect(
      deriveDrivingPresentationMode({
        ...baseInput,
        speedKilometersPerHour: 59,
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

import { describe, expect, it } from 'vitest';
import { stuckVehicleHelpFor } from '../src/game/stuckVehicle';

const eligible = {
  gameActive: true,
  simulationEnabled: true,
  blockingOverlay: false,
  fuel: 50,
  condition: 100,
  speedKilometersPerHour: 0.4,
  targetSpeedKilometersPerHour: 25,
  forwardIntent: false,
  stationaryMilliseconds: 1_750,
  movementBlockedBy: null,
} as const;

describe('ayuda por vehículo inmóvil', () => {
  it('aparece con intención válida y posición inmóvil', () => {
    expect(stuckVehicleHelpFor(eligible)).toEqual({
      visible: true,
      cause: null,
      canRetryAcceleration: true,
    });
  });

  it('no aparece durante pausa, narrativa, sin combustible o al moverse', () => {
    expect(
      stuckVehicleHelpFor({ ...eligible, simulationEnabled: false }).visible,
    ).toBe(false);
    expect(
      stuckVehicleHelpFor({ ...eligible, blockingOverlay: true }).visible,
    ).toBe(false);
    expect(stuckVehicleHelpFor({ ...eligible, fuel: 0 }).visible).toBe(false);
    expect(
      stuckVehicleHelpFor({ ...eligible, stationaryMilliseconds: 900 }).visible,
    ).toBe(false);
    expect(
      stuckVehicleHelpFor({ ...eligible, speedKilometersPerHour: 4 }).visible,
    ).toBe(false);
  });

  it('muestra una causa física real sin culpar al jugador', () => {
    expect(
      stuckVehicleHelpFor({ ...eligible, movementBlockedBy: 'water' }),
    ).toEqual({
      visible: true,
      cause: 'water',
      canRetryAcceleration: false,
    });
  });
});

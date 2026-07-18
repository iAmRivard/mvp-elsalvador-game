import { describe, expect, it } from 'vitest';
import { cameraRouteLookahead } from '../src/game/cameraRouteLookahead';
import type { ActiveNavigationState } from '../src/types/navigation';

const navigation: ActiveNavigationState = {
  routeSegmentIndex: 4,
  recommendedHeading: 0,
  maneuverType: 'turn-right',
  maneuverCoordinates: [-89.199, 13.7],
  distanceToManeuverMeters: 120,
  distanceToRouteMeters: 0,
  requiresRejoin: false,
};

describe('anticipación de ruta de la cámara', () => {
  it('no desplaza la cámara detenida ni sin navegación', () => {
    expect(
      cameraRouteLookahead({
        playerCoordinates: [-89.2, 13.7],
        playerHeading: 0,
        speedKilometersPerHour: 0,
        activeNavigation: navigation,
        nextInstruction: null,
        distanceToNextInstructionMeters: null,
      }).strength,
    ).toBe(0);
  });

  it('revela espacio por delante al circular sobre el corredor', () => {
    const result = cameraRouteLookahead({
      playerCoordinates: [-89.2, 13.7],
      playerHeading: 0,
      speedKilometersPerHour: 48,
      activeNavigation: navigation,
      nextInstruction: null,
      distanceToNextInstructionMeters: null,
    });

    expect(result.offsetXPixels).toBeCloseTo(0);
    expect(result.offsetYPixels).toBeGreaterThan(0);
    expect(result.anticipatesTurn).toBe(false);
  });

  it('desplaza el vehículo al lado opuesto del siguiente giro relevante', () => {
    const result = cameraRouteLookahead({
      playerCoordinates: [-89.2, 13.7],
      playerHeading: 0,
      speedKilometersPerHour: 48,
      activeNavigation: navigation,
      nextInstruction: {
        type: 'turn-right',
        coordinates: [-89.199, 13.7],
        distanceFromPreviousMeters: 100,
        distanceFromRouteStartMeters: 500,
        routeCoordinateIndex: 10,
        text: 'Gira a la derecha',
      },
      distanceToNextInstructionMeters: 100,
    });

    expect(result.offsetXPixels).toBeLessThan(0);
    expect(Math.abs(result.offsetXPixels)).toBeLessThanOrEqual(14);
    expect(Math.abs(result.offsetYPixels)).toBeLessThanOrEqual(14);
    expect(result.anticipatesTurn).toBe(true);
  });

  it('aumenta progresivamente con velocidad y cercanía del giro', () => {
    const instruction = {
      type: 'turn-right' as const,
      coordinates: [-89.199, 13.7] as [number, number],
      distanceFromPreviousMeters: 100,
      distanceFromRouteStartMeters: 500,
      routeCoordinateIndex: 10,
      text: 'Gira a la derecha',
    };
    const sample = (speed: number, distance: number) =>
      cameraRouteLookahead({
        playerCoordinates: [-89.2, 13.7],
        playerHeading: 0,
        speedKilometersPerHour: speed,
        activeNavigation: navigation,
        nextInstruction: instruction,
        distanceToNextInstructionMeters: distance,
      }).strength;

    expect(sample(30, 100)).toBeLessThan(sample(48, 100));
    expect(sample(48, 350)).toBeLessThan(sample(48, 100));
  });
});

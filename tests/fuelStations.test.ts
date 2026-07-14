import { describe, expect, it } from 'vitest';
import { fuelStationConfig } from '../src/config/fuelStations.config';
import { fuelStations } from '../src/data/fuelStations';
import {
  availableFuelStations,
  fuelAlertLevel,
  isWithinFuelStationRange,
  nearestAvailableFuelStation,
} from '../src/game/fuelStations';

describe('puntos narrativos de combustible', () => {
  it('encuentra la estación disponible más cercana', () => {
    const nearest = nearestAvailableFuelStation(
      [-89.1908911, 13.6962937],
      'chapter-1',
    );

    expect(nearest?.station.id).toBe('abastecimiento-san-salvador');
    expect(nearest?.distanceMeters).toBeGreaterThan(180);
    expect(fuelStations.every((station) => station.refuelAmount === 45)).toBe(
      true,
    );
  });

  it('excluye estaciones inactivas o de otro capítulo', () => {
    expect(availableFuelStations('chapter-2')).toEqual([]);
    expect(
      nearestAvailableFuelStation([-89.19, 13.69], 'chapter-1', [
        { ...fuelStations[0], active: false },
      ]),
    ).toBeNull();
  });

  it('aplica los umbrales de HUD y el radio de interacción', () => {
    expect(fuelAlertLevel(26)).toBeNull();
    expect(fuelAlertLevel(25)).toBe('low');
    expect(fuelAlertLevel(10)).toBe('critical');
    expect(
      isWithinFuelStationRange(fuelStationConfig.interactionRadiusMeters),
    ).toBe(true);
    expect(
      isWithinFuelStationRange(fuelStationConfig.interactionRadiusMeters + 0.1),
    ).toBe(false);
  });
});

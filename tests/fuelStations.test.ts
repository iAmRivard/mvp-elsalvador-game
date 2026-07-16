import { describe, expect, it } from 'vitest';
import { fuelStationConfig } from '../src/config/fuelStations.config';
import { fuelStations } from '../src/data/fuelStations';
import {
  availableFuelStations,
  fuelAlertLevel,
  fuelStationPresentation,
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
    expect(fuelAlertLevel(36)).toBeNull();
    expect(fuelAlertLevel(35)).toBe('low');
    expect(fuelAlertLevel(25)).toBe('low');
    expect(fuelAlertLevel(24.9)).toBe('critical');
    expect(
      isWithinFuelStationRange(fuelStationConfig.interactionRadiusMeters),
    ).toBe(true);
    expect(
      isWithinFuelStationRange(fuelStationConfig.interactionRadiusMeters + 0.1),
    ).toBe(false);
  });
  it('uses icon, compact and full presentations at the three fuel bands', () => {
    expect(
      fuelStationPresentation({
        fuelPercent: 75,
        hasActiveMission: true,
        selected: false,
        requiredByMission: false,
      }),
    ).toBe('icon');
    expect(
      fuelStationPresentation({
        fuelPercent: 30,
        hasActiveMission: true,
        selected: false,
        requiredByMission: false,
      }),
    ).toBe('compact');
    expect(
      fuelStationPresentation({
        fuelPercent: 20,
        hasActiveMission: true,
        selected: false,
        requiredByMission: false,
      }),
    ).toBe('full');
    expect(
      fuelStationPresentation({
        fuelPercent: 75,
        hasActiveMission: true,
        selected: true,
        requiredByMission: false,
      }),
    ).toBe('full');
  });
});

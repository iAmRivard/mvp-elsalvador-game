import { describe, expect, it } from 'vitest';
import { locations } from '../src/data/locations';
import {
  distanceBetweenMeters,
  findDiscoverableLocations,
  findNearestLocation,
} from '../src/game/discovery';
import { EL_SALVADOR_MOVEMENT_BOUNDS } from '../src/game/movement';

describe('ubicaciones y descubrimiento', () => {
  it('define las doce ubicaciones requeridas con identificadores únicos', () => {
    expect(locations).toHaveLength(12);
    expect(new Set(locations.map((location) => location.id)).size).toBe(12);
  });

  it('mantiene todas las coordenadas dentro del área del juego', () => {
    for (const location of locations) {
      const [longitude, latitude] = location.coordinates;
      expect(longitude).toBeGreaterThanOrEqual(EL_SALVADOR_MOVEMENT_BOUNDS.west);
      expect(longitude).toBeLessThanOrEqual(EL_SALVADOR_MOVEMENT_BOUNDS.east);
      expect(latitude).toBeGreaterThanOrEqual(EL_SALVADOR_MOVEMENT_BOUNDS.south);
      expect(latitude).toBeLessThanOrEqual(EL_SALVADOR_MOVEMENT_BOUNDS.north);
    }
  });

  it('descubre San Salvador al iniciar dentro de su radio', () => {
    const discovered = findDiscoverableLocations([-89.191111, 13.6975], [], ['san-salvador']);
    expect(discovered.map((location) => location.id)).toContain('san-salvador');
  });

  it('no descubre ubicaciones bloqueadas aunque el jugador esté encima', () => {
    const discovered = findDiscoverableLocations([-89.63, 13.852778], [], []);
    expect(discovered).toEqual([]);
  });

  it('calcula proximidad y descarta lugares fuera del umbral', () => {
    expect(distanceBetweenMeters([-89.191111, 13.6975], [-89.191111, 13.6975])).toBe(0);
    expect(findNearestLocation([-89.191111, 13.6975], 500)?.id).toBe('san-salvador');
    expect(findNearestLocation([-88.8, 13.4], 500)).toBeNull();
  });
});

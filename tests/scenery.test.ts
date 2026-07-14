import { describe, expect, it } from 'vitest';
import { chapterScenery } from '../src/data/scenery';
import { EL_SALVADOR_MOVEMENT_BOUNDS } from '../src/game/movement';

describe('referencias visuales del corredor', () => {
  it('mantiene una cantidad acotada y cubre todos los tipos', () => {
    expect(chapterScenery.length).toBeGreaterThanOrEqual(50);
    expect(chapterScenery.length).toBeLessThan(80);
    expect(new Set(chapterScenery.map((instance) => instance.kind))).toEqual(
      new Set(['tree', 'post', 'barrier', 'light', 'station']),
    );
  });

  it('ubica cada instancia dentro del área jugable', () => {
    for (const instance of chapterScenery) {
      const [longitude, latitude] = instance.coordinates;
      expect(longitude).toBeGreaterThanOrEqual(
        EL_SALVADOR_MOVEMENT_BOUNDS.west,
      );
      expect(longitude).toBeLessThanOrEqual(EL_SALVADOR_MOVEMENT_BOUNDS.east);
      expect(latitude).toBeGreaterThanOrEqual(
        EL_SALVADOR_MOVEMENT_BOUNDS.south,
      );
      expect(latitude).toBeLessThanOrEqual(EL_SALVADOR_MOVEMENT_BOUNDS.north);
    }
  });
});

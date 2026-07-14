import { describe, expect, it } from 'vitest';
import { distanceToRouteMeters } from '../src/map/missionRoute';

describe('mission route deviation', () => {
  it('measures distance to nearby route segments', () => {
    const route: [number, number][] = [
      [-89.3, 13.7],
      [-89.299, 13.7],
      [-89.298, 13.7],
    ];
    expect(distanceToRouteMeters([-89.2995, 13.7], route)).toBeCloseTo(0, 5);
    expect(distanceToRouteMeters([-89.2995, 13.701], route)).toBeGreaterThan(
      100,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { distanceBetweenMeters } from '../src/game/discovery';
import {
  distanceToRouteMeters,
  navigationArrowPosition,
} from '../src/map/missionRoute';

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

  it('places the navigation chevron ahead and apart from the player', () => {
    const route: [number, number][] = [
      [-89.3, 13.7],
      [-89.2998, 13.7],
      [-89.2994, 13.7],
    ];
    const position = navigationArrowPosition(route, 0, 28);

    expect(position).not.toBeNull();
    expect(distanceBetweenMeters(route[0], position!)).toBeCloseTo(28, 1);
    expect(position).not.toEqual(route[0]);
  });

  it('returns null when the route has no valid point ahead', () => {
    expect(
      navigationArrowPosition(
        [
          [-89.3, 13.7],
          [-89.29995, 13.7],
        ],
        0,
        35,
      ),
    ).toBeNull();
  });
});

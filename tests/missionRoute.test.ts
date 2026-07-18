import { describe, expect, it } from 'vitest';
import { distanceBetweenMeters } from '../src/game/discovery';
import {
  directFallbackNavigationProgress,
  distanceToRouteMeters,
  navigationArrowPosition,
  routeOriginMovedBeyondTolerance,
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

  it('invalida una ruta si el jugador cambia de origen mientras se calcula', () => {
    const origin: [number, number] = [-89.2, 13.7];

    expect(routeOriginMovedBeyondTolerance(origin, [-89.19995, 13.7])).toBe(
      false,
    );
    expect(routeOriginMovedBeyondTolerance(origin, [-89.1995, 13.7])).toBe(
      true,
    );
  });

  it('reduce la distancia fallback y cambia a llegada cerca del destino', () => {
    const destination: [number, number] = [-89.199, 13.7];
    const far = directFallbackNavigationProgress(
      [-89.2, 13.7],
      destination,
      90,
    );
    const near = directFallbackNavigationProgress(
      [-89.1991, 13.7],
      destination,
      90,
    );

    expect(far.nextInstruction?.type).toBe('continue');
    expect(near.nextInstruction?.type).toBe('arrive');
    expect(near.distanceToNextInstructionMeters).toBeLessThan(
      far.distanceToNextInstructionMeters,
    );
    expect(near.activeNavigation?.requiresRejoin).toBe(false);
    expect(near.distanceToRouteMeters).toBe(0);
  });
});

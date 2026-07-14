import { describe, expect, it } from 'vitest';
import {
  navigationGuidanceMessage,
  vehicleOrientation,
} from '../src/map/navigationGuidance';
import {
  recommendedRouteHeading,
  signedHeadingDifference,
} from '../src/map/routeHeading';
import type { ActiveNavigationState } from '../src/types/navigation';
import type { RoadCoordinates } from '../src/types/roads';

const westbound: RoadCoordinates[] = [
  [-89.3, 13.7],
  [-89.301, 13.7],
  [-89.302, 13.7],
];
const eastbound: RoadCoordinates[] = [...westbound].reverse();

describe('recommendedRouteHeading', () => {
  it('recommends the actual route direction to the left and right', () => {
    const left = recommendedRouteHeading([-89.3004, 13.7], 90, westbound, null);
    const right = recommendedRouteHeading(
      [-89.3016, 13.7],
      270,
      eastbound,
      null,
    );

    expect(left?.heading).toBeCloseTo(270, 0);
    expect(right?.heading).toBeCloseTo(90, 0);
  });

  it('keeps the recommendation when the vehicle faces the opposite way', () => {
    const result = recommendedRouteHeading([-89.3004, 13.7], 90, westbound, 0);

    expect(result?.segmentIndex).toBe(0);
    expect(Math.abs(signedHeadingDifference(90, result?.heading ?? 90))).toBe(
      180,
    );
  });

  it('marks a connector when the vehicle must rejoin', () => {
    const result = recommendedRouteHeading(
      [-89.3004, 13.701],
      180,
      westbound,
      0,
    );

    expect(result?.requiresRejoin).toBe(true);
    expect(result?.distanceToSegmentMeters).toBeGreaterThan(100);
  });

  it('uses continuity on a return instead of jumping to a nearby old segment', () => {
    const route: RoadCoordinates[] = [
      [-89.3, 13.7],
      [-89.299, 13.7],
      [-89.299, 13.701],
      [-89.3, 13.701],
      [-89.30002, 13.70005],
    ];
    const result = recommendedRouteHeading([-89.30001, 13.7001], 180, route, 3);

    expect(result?.segmentIndex).toBe(3);
  });

  it('stays on the known branch when parallel segments are equally close', () => {
    const route: RoadCoordinates[] = [
      [-89.3, 13.7],
      [-89.298, 13.7],
      [-89.298, 13.7002],
      [-89.3, 13.7002],
    ];
    const result = recommendedRouteHeading([-89.299, 13.7001], 270, route, 2);

    expect(result?.segmentIndex).toBe(2);
    expect(result?.heading).toBeCloseTo(270, 0);
  });

  it('can reacquire the nearest segment after recalculation', () => {
    const route: RoadCoordinates[] = [
      [-89.3, 13.7],
      [-89.299, 13.7],
      [-89.298, 13.7],
    ];
    const result = recommendedRouteHeading(
      [-89.2984, 13.70002],
      90,
      route,
      null,
    );

    expect(result?.segmentIndex).toBe(1);
  });

  it('does not jump across nearby non-consecutive circular segments', () => {
    const route: RoadCoordinates[] = [
      [-89.3, 13.7],
      [-89.299, 13.7],
      [-89.299, 13.701],
      [-89.3, 13.701],
      [-89.3, 13.7],
    ];
    const result = recommendedRouteHeading([-89.30001, 13.7001], 180, route, 3);

    expect(result?.segmentIndex).toBe(3);
  });

  it('returns the same route recommendation while stopped or reversing', () => {
    const stopped = recommendedRouteHeading([-89.3004, 13.7], 90, westbound, 0);
    const reversing = recommendedRouteHeading(
      [-89.3004, 13.7],
      270,
      westbound,
      0,
    );

    expect(stopped?.segmentIndex).toBe(reversing?.segmentIndex);
    expect(stopped?.heading).toBeCloseTo(reversing?.heading ?? 0, 4);
  });
});

describe('navigation guidance', () => {
  const navigation: ActiveNavigationState = {
    routeSegmentIndex: 0,
    recommendedHeading: 270,
    maneuverType: 'turn-left',
    maneuverCoordinates: [-89.301, 13.7],
    distanceToManeuverMeters: 20,
    distanceToRouteMeters: 0,
    requiresRejoin: false,
  };

  it('explains a contradictory stopped heading without rotating the vehicle', () => {
    expect(
      navigationGuidanceMessage(
        navigation,
        vehicleOrientation(90, 270),
        0,
        3,
        false,
      ),
    ).toBe('Gira el vehículo hacia la izquierda para seguir la ruta');
  });

  it('uses the same recommended heading for the rejoin instruction', () => {
    expect(
      navigationGuidanceMessage(
        { ...navigation, requiresRejoin: true },
        vehicleOrientation(0, 270),
        4,
        40,
        false,
      ),
    ).toBe('Gira a la izquierda para volver al camino');
  });

  it('does not show forward guidance while reversing', () => {
    expect(
      navigationGuidanceMessage(
        navigation,
        vehicleOrientation(90, 270),
        -2,
        3,
        true,
      ),
    ).toBeNull();
  });
});

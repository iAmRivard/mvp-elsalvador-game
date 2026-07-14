import { describe, expect, it } from 'vitest';
import { RoadTracker } from '../src/roads/roadTracker';
import { RoadSpatialIndex } from '../src/roads/spatialIndex';
import type { RoadNetwork } from '../src/types/roads';
import { createRoadTestNetwork } from './roadTestNetwork';

function parallelRoadNetwork(): RoadNetwork {
  return {
    version: 1,
    generatedAt: '2026-07-13T00:00:00.000Z',
    sourceId: 'parallel-road-test',
    bounds: [
      [-89.301, 13.699],
      [-89.298, 13.701],
    ],
    nodes: [
      { id: 0, coordinates: [-89.3, 13.7] },
      { id: 1, coordinates: [-89.299, 13.7] },
      { id: 2, coordinates: [-89.3, 13.70005] },
      { id: 3, coordinates: [-89.299, 13.70005] },
    ],
    edges: [
      {
        id: 0,
        from: 0,
        to: 1,
        coordinates: [
          [-89.3, 13.7],
          [-89.299, 13.7],
        ],
        distanceMeters: 108,
        roadClass: 'primary',
        oneWay: false,
        speedMultiplier: 1,
      },
      {
        id: 1,
        from: 2,
        to: 3,
        coordinates: [
          [-89.3, 13.70005],
          [-89.299, 13.70005],
        ],
        distanceMeters: 108,
        roadClass: 'primary',
        oneWay: false,
        speedMultiplier: 1,
      },
    ],
  };
}

function roundaboutRoadNetwork(): RoadNetwork {
  return {
    version: 1,
    generatedAt: '2026-07-13T00:00:00.000Z',
    sourceId: 'roundabout-road-test',
    bounds: [
      [-89.3004, 13.6998],
      [-89.2998, 13.7002],
    ],
    nodes: [
      { id: 0, coordinates: [-89.3001, 13.7] },
      { id: 1, coordinates: [-89.3, 13.7001] },
      { id: 2, coordinates: [-89.2999, 13.7] },
      { id: 3, coordinates: [-89.3, 13.6999] },
      { id: 4, coordinates: [-89.30035, 13.7] },
    ],
    edges: [
      {
        id: 10,
        from: 0,
        to: 1,
        coordinates: [
          [-89.3001, 13.7],
          [-89.30007, 13.70007],
          [-89.3, 13.7001],
        ],
        distanceMeters: 18,
        roadClass: 'primary',
        oneWay: true,
        speedMultiplier: 1,
      },
      {
        id: 11,
        from: 1,
        to: 2,
        coordinates: [
          [-89.3, 13.7001],
          [-89.29993, 13.70007],
          [-89.2999, 13.7],
        ],
        distanceMeters: 18,
        roadClass: 'primary',
        oneWay: true,
        speedMultiplier: 1,
      },
      {
        id: 12,
        from: 2,
        to: 3,
        coordinates: [
          [-89.2999, 13.7],
          [-89.29993, 13.69993],
          [-89.3, 13.6999],
        ],
        distanceMeters: 18,
        roadClass: 'primary',
        oneWay: true,
        speedMultiplier: 1,
      },
      {
        id: 13,
        from: 3,
        to: 0,
        coordinates: [
          [-89.3, 13.6999],
          [-89.30007, 13.69993],
          [-89.3001, 13.7],
        ],
        distanceMeters: 18,
        roadClass: 'primary',
        oneWay: true,
        speedMultiplier: 1,
      },
      {
        id: 14,
        from: 4,
        to: 0,
        coordinates: [
          [-89.30035, 13.7],
          [-89.3001, 13.7],
        ],
        distanceMeters: 27,
        roadClass: 'secondary',
        oneWay: true,
        speedMultiplier: 0.9,
      },
    ],
  };
}

describe('road tracker', () => {
  it('uses hysteresis at an intersection before changing edges', () => {
    const tracker = new RoadTracker(
      new RoadSpatialIndex(createRoadTestNetwork()),
    );

    expect(tracker.update([-89.2991, 13.70002])?.edge.id).toBe(0);
    expect(tracker.update([-89.299, 13.70003])?.edge.id).toBe(0);
    expect(tracker.update([-89.299, 13.7001])?.edge.id).toBe(2);
  });

  it('disengages after leaving the configured road radius', () => {
    const tracker = new RoadTracker(
      new RoadSpatialIndex(createRoadTestNetwork()),
    );
    expect(tracker.update([-89.2995, 13.7])).not.toBeNull();
    expect(tracker.update([-89.31, 13.71])).toBeNull();
  });

  it('uses heading to choose the intended branch of a T intersection', () => {
    const index = new RoadSpatialIndex(createRoadTestNetwork());
    const eastbound = new RoadTracker(index);
    const northbound = new RoadTracker(index);
    const position: [number, number] = [-89.299, 13.70002];

    expect(eastbound.update(position, { heading: 90 })?.edge.id).toBe(0);
    expect(northbound.update(position, { heading: 0 })?.edge.id).toBe(2);
  });

  it('prioritizes an active route edge over a slightly nearer branch', () => {
    const tracker = new RoadTracker(
      new RoadSpatialIndex(createRoadTestNetwork()),
    );

    expect(
      tracker.update([-89.2991, 13.70001], {
        heading: 90,
        activeRouteEdgeIds: new Set([2]),
      })?.edge.id,
    ).toBe(2);
    expect(tracker.getDiagnostics().selectedScore).toBeGreaterThan(0);
  });

  it('does not jump to a disconnected parallel road for a tiny distance gain', () => {
    const tracker = new RoadTracker(
      new RoadSpatialIndex(parallelRoadNetwork(), 0.0001),
    );

    expect(
      tracker.update([-89.2995, 13.700005], { heading: 90 })?.edge.id,
    ).toBe(0);
    expect(tracker.update([-89.2995, 13.70004], { heading: 90 })?.edge.id).toBe(
      0,
    );
    expect(
      tracker.update([-89.2995, 13.70004], {
        heading: 90,
        activeRouteEdgeIds: new Set([1]),
      })?.edge.id,
    ).toBe(1);
  });

  it('penalizes travel against the direction of a one-way edge', () => {
    const tracker = new RoadTracker(
      new RoadSpatialIndex(createRoadTestNetwork()),
    );
    tracker.update([-89.2985, 13.7], { heading: 270 });

    const oneWay = tracker
      .getDiagnostics()
      .candidates.find((candidate) => candidate.edgeId === 1);
    expect(oneWay?.score.headingScore).toBeLessThan(0);
  });

  it('keeps continuity through the requested arc of a one-way roundabout', () => {
    const tracker = new RoadTracker(
      new RoadSpatialIndex(roundaboutRoadNetwork(), 0.0001),
    );
    const activeRouteEdgeIds = new Set([14, 10, 11]);

    expect(
      tracker.update([-89.3002, 13.7], {
        heading: 90,
        activeRouteEdgeIds,
      })?.edge.id,
    ).toBe(14);
    expect(
      tracker.update([-89.30008, 13.70003], {
        heading: 45,
        activeRouteEdgeIds,
      })?.edge.id,
    ).toBe(10);
  });

  it('uses road class only as a tie-breaker before heading intent', () => {
    const index = new RoadSpatialIndex(createRoadTestNetwork());
    const neutral = new RoadTracker(index);
    const turning = new RoadTracker(index);
    const position: [number, number] = [-89.299, 13.70002];

    expect(neutral.update(position)?.edge.id).toBe(0);
    expect(turning.update(position, { heading: 0 })?.edge.id).toBe(2);
  });
});

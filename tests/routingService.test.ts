import { describe, expect, it } from 'vitest';
import { AStarRouter } from '../src/roads/routingService';
import { RoadSpatialIndex } from '../src/roads/spatialIndex';
import type { RoadNetwork } from '../src/types/roads';
import { createRoadTestNetwork } from './roadTestNetwork';

function alternateRouteNetwork(): RoadNetwork {
  return {
    version: 1,
    generatedAt: '2026-07-12T23:45:51.000Z',
    sourceId: 'routing-test',
    bounds: [
      [-89.301, 13.699],
      [-89.298, 13.702],
    ],
    nodes: [
      { id: 0, coordinates: [-89.3, 13.7] },
      { id: 1, coordinates: [-89.2995, 13.701] },
      { id: 2, coordinates: [-89.299, 13.7] },
    ],
    edges: [
      {
        id: 0,
        from: 0,
        to: 2,
        coordinates: [
          [-89.3, 13.7],
          [-89.299, 13.7],
        ],
        distanceMeters: 100,
        roadClass: 'track',
        oneWay: false,
        speedMultiplier: 0.4,
      },
      {
        id: 1,
        from: 0,
        to: 1,
        coordinates: [
          [-89.3, 13.7],
          [-89.2995, 13.701],
        ],
        distanceMeters: 80,
        roadClass: 'primary',
        oneWay: false,
        speedMultiplier: 1,
      },
      {
        id: 2,
        from: 1,
        to: 2,
        coordinates: [
          [-89.2995, 13.701],
          [-89.299, 13.7],
        ],
        distanceMeters: 80,
        roadClass: 'primary',
        oneWay: false,
        speedMultiplier: 1,
      },
    ],
  };
}

function routerFor(network: RoadNetwork): AStarRouter {
  return new AStarRouter(network, new RoadSpatialIndex(network));
}

describe('local A* routing', () => {
  it('builds a route with road geometry and partial endpoint edges', () => {
    const router = routerFor(createRoadTestNetwork());
    const route = router.getRoute({
      origin: [-89.3, 13.7],
      destination: [-89.298, 13.7],
    });

    expect(route).not.toBeNull();
    expect(route?.edgeIds).toEqual([0, 1]);
    expect(route?.coordinates.length).toBeGreaterThan(3);
    expect(route?.distanceMeters).toBeCloseTo(216.2, 0);
    expect(route?.estimatedGameDurationSeconds).toBeGreaterThan(0);
  });

  it('respects a one-way edge and returns null in the forbidden direction', () => {
    const router = routerFor(createRoadTestNetwork());
    expect(
      router.getRoute({
        origin: [-89.298, 13.7],
        destination: [-89.3, 13.7],
      }),
    ).toBeNull();
  });

  it('prefers a longer primary route over a slower track', () => {
    const network = alternateRouteNetwork();
    const route = routerFor(network).getRoute({
      origin: network.nodes[0].coordinates,
      destination: network.nodes[2].coordinates,
    });
    expect(route?.edgeIds).toEqual([1, 2]);
    expect(route?.distanceMeters).toBe(160);
  });

  it('uses closures and edge penalties when selecting an alternative', () => {
    const network = alternateRouteNetwork();
    const router = routerFor(network);
    const closed = router.getRoute({
      origin: network.nodes[0].coordinates,
      destination: network.nodes[2].coordinates,
      temporarilyClosedEdgeIds: [1],
    });
    const penalized = router.getRoute({
      origin: network.nodes[0].coordinates,
      destination: network.nodes[2].coordinates,
      edgePenaltyMultipliers: { 1: 3 },
    });

    expect(closed?.edgeIds).toEqual([0]);
    expect(penalized?.edgeIds).toEqual([0]);
  });

  it('returns null outside coverage and memoizes identical requests', () => {
    const router = routerFor(createRoadTestNetwork());
    const request = {
      origin: [-89.3, 13.7] as [number, number],
      destination: [-89.298, 13.7] as [number, number],
    };
    expect(router.getRoute(request)).not.toBeNull();
    expect(router.getRoute(request)).not.toBeNull();
    expect(
      router.getRoute({
        origin: [-90, 14],
        destination: [-89.298, 13.7],
      }),
    ).toBeNull();
    expect(router.getDiagnostics()).toMatchObject({
      calculations: 2,
      cacheHits: 1,
    });
    expect(
      router.getDiagnostics().lastExpandedNodeCount,
    ).toBeGreaterThanOrEqual(0);
  });
});

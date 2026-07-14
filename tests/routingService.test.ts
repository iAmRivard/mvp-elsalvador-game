import { describe, expect, it, vi } from 'vitest';
import type { LoadedRoadNetwork } from '../src/roads/roadNetwork';
import { AStarRouter, LocalRoutingService } from '../src/roads/routingService';
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

function loadedNetwork(network: RoadNetwork): LoadedRoadNetwork {
  const index = new RoadSpatialIndex(network);
  return {
    network,
    index,
    loadDurationMilliseconds: 10,
    fileSizeBytes: 1_024,
    metrics: {
      downloadDurationMilliseconds: 2,
      decodeDurationMilliseconds: 1,
      parseDurationMilliseconds: 2,
      validationDurationMilliseconds: 1,
      indexDurationMilliseconds: 4,
      totalDurationMilliseconds: 10,
      fileSizeBytes: 1_024,
      approximateMemoryBytes: 4_096,
      nodeCount: network.nodes.length,
      edgeCount: network.edges.length,
    },
  };
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

  it('evicts the least recently used route when the cache is full', () => {
    const router = routerFor(createRoadTestNetwork());
    const requestAt = (index: number) => ({
      origin: [-89.3 + index * 0.00001, 13.7] as [number, number],
      destination: [-89.298, 13.7] as [number, number],
    });
    for (let index = 0; index < 32; index += 1) {
      router.getRoute(requestAt(index));
    }
    router.getRoute(requestAt(0));
    router.getRoute(requestAt(32));
    router.getRoute(requestAt(1));

    expect(router.getDiagnostics()).toMatchObject({
      calculations: 34,
      cacheHits: 1,
      cacheEntries: 32,
    });
  });

  it('uses the worker first and falls back to local A star on worker errors', async () => {
    const network = createRoadTestNetwork();
    const loaded = loadedNetwork(network);
    const request = {
      origin: network.nodes[0].coordinates,
      destination: network.nodes[2].coordinates,
    };
    const expectedRoute = routerFor(network).getRoute(request);
    const loader = vi.fn(() => Promise.resolve(loaded));
    const workerRoute = vi.fn(() => Promise.resolve(expectedRoute));
    const workerService = new LocalRoutingService(loader, {
      getRoute: workerRoute,
    });

    await expect(workerService.getRoute(request)).resolves.toEqual(
      expectedRoute,
    );
    expect(workerRoute).toHaveBeenCalledOnce();
    expect(loader).not.toHaveBeenCalled();

    const fallbackService = new LocalRoutingService(loader, {
      getRoute: () => Promise.reject(new Error('worker unavailable')),
    });
    await expect(fallbackService.getRoute(request)).resolves.toEqual(
      expectedRoute,
    );
    expect(loader).toHaveBeenCalledOnce();
  });
});

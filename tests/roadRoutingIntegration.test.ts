/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseRoadNetwork } from '../src/roads/roadNetwork';
import { AStarRouter } from '../src/roads/routingService';
import { RoadSpatialIndex } from '../src/roads/spatialIndex';

describe('generated western corridor routing', () => {
  it('connects the new-game spawn to Santa Ana over local roads', async () => {
    const serialized = await readFile(
      'public/data/roads/western-corridor.json',
      'utf8',
    );
    const network = parseRoadNetwork(JSON.parse(serialized) as unknown);
    const router = new AStarRouter(network, new RoadSpatialIndex(network));
    const route = router.getRoute({
      origin: [-89.1908911, 13.6962937],
      destination: [-89.556667, 13.994722],
    });

    expect(route).not.toBeNull();
    expect(route?.coordinates.length).toBeGreaterThan(100);
    expect(route?.edgeIds.length).toBeGreaterThan(20);
    expect(route?.distanceMeters).toBeGreaterThan(40_000);
    expect(route?.distanceMeters).toBeLessThan(90_000);
    expect(route?.estimatedGameDurationSeconds).toBeLessThan(20 * 60);
    expect(router.getDiagnostics().lastExpandedNodeCount).toBeGreaterThan(0);
  });
});

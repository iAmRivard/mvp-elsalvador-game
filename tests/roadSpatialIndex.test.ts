import { afterEach, describe, expect, it } from 'vitest';
import {
  findNearestRoad,
  projectPositionOntoRoad,
  RoadSpatialIndex,
  setDefaultRoadSpatialIndex,
} from '../src/roads/spatialIndex';
import { createRoadTestNetwork } from './roadTestNetwork';

afterEach(() => setDefaultRoadSpatialIndex(null));

describe('road spatial index', () => {
  it('projects a position onto the nearest point of a road geometry', () => {
    const edge = createRoadTestNetwork().edges[0];
    const projected = projectPositionOntoRoad([-89.2995, 13.7002], edge);

    expect(projected[0]).toBeCloseTo(-89.2995, 6);
    expect(projected[1]).toBeCloseTo(13.7, 6);
  });

  it('finds a nearby segment and reports progress and road metadata', () => {
    const index = new RoadSpatialIndex(createRoadTestNetwork(), 0.0005);
    const result = index.findNearestRoad([-89.29925, 13.70005], 20);

    expect(result).not.toBeNull();
    expect(result?.edgeId).toBe(0);
    expect(result?.roadClass).toBe('primary');
    expect(result?.distanceMeters).toBeLessThan(6);
    expect(result?.progress).toBeGreaterThan(0.7);
    expect(result?.progress).toBeLessThan(0.8);
  });

  it('returns null when every indexed road is outside the maximum radius', () => {
    const index = new RoadSpatialIndex(createRoadTestNetwork());
    expect(index.findNearestRoad([-89.31, 13.71], 25)).toBeNull();
  });

  it('returns one nearest candidate per edge at an intersection', () => {
    const index = new RoadSpatialIndex(createRoadTestNetwork(), 0.0005);
    const candidates = index.findRoadCandidates([-89.299, 13.70002], 25);

    expect(candidates.map((candidate) => candidate.edgeId)).toEqual([2, 0, 1]);
    expect(new Set(candidates.map((candidate) => candidate.edgeId)).size).toBe(
      candidates.length,
    );
    expect(index.getMetrics().searches).toBe(1);
  });

  it('uses the installed index through the two-argument public function', () => {
    expect(findNearestRoad([-89.2995, 13.7], 10)).toBeNull();
    const index = new RoadSpatialIndex(createRoadTestNetwork());
    setDefaultRoadSpatialIndex(index);

    expect(findNearestRoad([-89.2995, 13.7], 10)?.edgeId).toBe(0);
    expect(index.getMetrics()).toMatchObject({ searches: 1, segmentCount: 4 });
    expect(
      index.getMetrics().averageDurationMilliseconds,
    ).toBeGreaterThanOrEqual(0);
  });
});

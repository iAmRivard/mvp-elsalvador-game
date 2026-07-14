import { describe, expect, it } from 'vitest';
import { RoadTracker } from '../src/roads/roadTracker';
import { RoadSpatialIndex } from '../src/roads/spatialIndex';
import { createRoadTestNetwork } from './roadTestNetwork';

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
});

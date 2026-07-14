import type { RoadNetwork } from '../src/types/roads';

export function createRoadTestNetwork(): RoadNetwork {
  return {
    version: 1,
    generatedAt: '2026-07-12T23:45:51.000Z',
    sourceId: 'test-network',
    bounds: [
      [-89.301, 13.699],
      [-89.297, 13.702],
    ],
    nodes: [
      { id: 0, coordinates: [-89.3, 13.7] },
      { id: 1, coordinates: [-89.299, 13.7] },
      { id: 2, coordinates: [-89.298, 13.7] },
      { id: 3, coordinates: [-89.299, 13.701] },
    ],
    edges: [
      {
        id: 0,
        from: 0,
        to: 1,
        coordinates: [
          [-89.3, 13.7],
          [-89.2995, 13.7],
          [-89.299, 13.7],
        ],
        distanceMeters: 108.1,
        roadClass: 'primary',
        oneWay: false,
        speedMultiplier: 1,
      },
      {
        id: 1,
        from: 1,
        to: 2,
        coordinates: [
          [-89.299, 13.7],
          [-89.298, 13.7],
        ],
        distanceMeters: 108.1,
        roadClass: 'secondary',
        oneWay: true,
        speedMultiplier: 0.9,
      },
      {
        id: 2,
        from: 1,
        to: 3,
        coordinates: [
          [-89.299, 13.7],
          [-89.299, 13.701],
        ],
        distanceMeters: 111.1,
        roadClass: 'residential',
        oneWay: false,
        speedMultiplier: 0.65,
      },
    ],
  };
}

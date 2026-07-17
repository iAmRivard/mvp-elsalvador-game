import { describe, expect, it } from 'vitest';
import {
  clearRouteRejoinRoadSource,
  getRouteRejoinRoadSource,
  setRouteRejoinRoadSource,
} from '../src/roads/routeRejoinRoadSource';
import { RoadSpatialIndex } from '../src/roads/spatialIndex';
import { createRoadTestNetwork } from './roadTestNetwork';

describe('fuente vial compartida para reincorporación', () => {
  it('un cleanup antiguo no elimina la fuente que lo reemplazó', () => {
    const network = createRoadTestNetwork();
    const firstIndex = new RoadSpatialIndex(network);
    const replacementIndex = new RoadSpatialIndex(network);
    const edgesById = new Map(network.edges.map((edge) => [edge.id, edge]));

    setRouteRejoinRoadSource({ index: firstIndex, edgesById });
    setRouteRejoinRoadSource({ index: replacementIndex, edgesById });
    clearRouteRejoinRoadSource(firstIndex);

    expect(getRouteRejoinRoadSource()?.index).toBe(replacementIndex);
    clearRouteRejoinRoadSource(replacementIndex);
    expect(getRouteRejoinRoadSource()).toBeNull();
  });
});

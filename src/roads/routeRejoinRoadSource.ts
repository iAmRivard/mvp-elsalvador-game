import type { RoadEdge } from '../types/roads';
import type { RoadSpatialIndex } from './spatialIndex';

export interface RouteRejoinRoadSource {
  index: RoadSpatialIndex;
  edgesById: ReadonlyMap<number, RoadEdge>;
}

let activeSource: RouteRejoinRoadSource | null = null;

export function setRouteRejoinRoadSource(
  source: RouteRejoinRoadSource,
): void {
  activeSource = source;
}

export function clearRouteRejoinRoadSource(index: RoadSpatialIndex): void {
  if (activeSource?.index === index) activeSource = null;
}

export function getRouteRejoinRoadSource(): RouteRejoinRoadSource | null {
  return activeSource;
}

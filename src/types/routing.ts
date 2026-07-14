import type { RoadCoordinates } from './roads';

export interface RouteRequest {
  origin: RoadCoordinates;
  destination: RoadCoordinates;
  blockedEdgeIds?: readonly number[];
  temporarilyClosedEdgeIds?: readonly number[];
  edgePenaltyMultipliers?: Readonly<Record<number, number>>;
}

export interface RouteResult {
  coordinates: RoadCoordinates[];
  distanceMeters: number;
  estimatedGameDurationSeconds: number;
  edgeIds: number[];
}

export interface RoutingService {
  getRoute(request: RouteRequest): Promise<RouteResult | null>;
}

export interface RoutingDiagnostics {
  calculations: number;
  cacheHits: number;
  averageDurationMilliseconds: number;
  lastExpandedNodeCount: number;
}

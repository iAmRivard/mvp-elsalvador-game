import type {
  RouteRequest,
  RouteResult,
  RoutingDiagnostics,
} from '../types/routing';

export interface RoadWorkerLoadMetrics {
  decodeDurationMilliseconds: number;
  parseDurationMilliseconds: number;
  validationDurationMilliseconds: number;
  indexDurationMilliseconds: number;
  routerPreparationDurationMilliseconds: number;
  totalDurationMilliseconds: number;
  fileSizeBytes: number;
  nodeCount: number;
  edgeCount: number;
}

export interface LoadRoadNetworkRequest {
  type: 'load-road-network';
  requestId: string;
  buffer: ArrayBuffer;
}

export interface BuildIndexRequest {
  type: 'build-index';
  requestId: string;
}

export interface CalculateRouteRequest {
  type: 'calculate-route';
  requestId: string;
  request: RouteRequest;
}

export interface CancelRouteRequest {
  type: 'cancel-route';
  requestId: string;
}

export type RoadWorkerRequest =
  | LoadRoadNetworkRequest
  | BuildIndexRequest
  | CalculateRouteRequest
  | CancelRouteRequest;

export interface RoadNetworkReadyResponse {
  type: 'road-network-ready';
  requestId: string;
  metrics: RoadWorkerLoadMetrics;
}

export interface RouteCalculatedResponse {
  type: 'route-calculated';
  requestId: string;
  route: RouteResult | null;
  durationMilliseconds: number;
  diagnostics: RoutingDiagnostics;
}

export interface RoadWorkerErrorResponse {
  type: 'road-worker-error';
  requestId: string;
  operation: 'load' | 'index' | 'route';
  message: string;
}

export interface RoadWorkerMetricsResponse {
  type: 'road-worker-metrics';
  requestId: string;
  metrics: RoadWorkerLoadMetrics | null;
}

export type RoadWorkerResponse =
  | RoadNetworkReadyResponse
  | RouteCalculatedResponse
  | RoadWorkerErrorResponse
  | RoadWorkerMetricsResponse;

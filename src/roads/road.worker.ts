/// <reference lib="webworker" />

import type { RoutingDiagnostics } from '../types/routing';
import { parseRoadNetwork } from './roadNetwork';
import { AStarRouter } from './routingService';
import { RoadSpatialIndex } from './spatialIndex';
import type {
  RoadWorkerLoadMetrics,
  RoadWorkerRequest,
  RoadWorkerResponse,
} from './roadWorkerProtocol';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
let router: AStarRouter | null = null;
let loadMetrics: RoadWorkerLoadMetrics | null = null;
const canceledRouteIds = new Set<string>();

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Error vial desconocido.';
}

function post(response: RoadWorkerResponse): void {
  workerScope.postMessage(response);
}

workerScope.onmessage = (event: MessageEvent<RoadWorkerRequest>) => {
  const message = event.data;
  if (message.type === 'cancel-route') {
    canceledRouteIds.add(message.requestId);
    return;
  }

  if (message.type === 'build-index') {
    post({
      type: 'road-worker-metrics',
      requestId: message.requestId,
      metrics: loadMetrics,
    });
    return;
  }

  if (message.type === 'load-road-network') {
    try {
      const startedAt = performance.now();
      let stageStartedAt = performance.now();
      const serialized = new TextDecoder().decode(message.buffer);
      const decodeDurationMilliseconds = performance.now() - stageStartedAt;
      stageStartedAt = performance.now();
      const parsed = JSON.parse(serialized) as unknown;
      const parseDurationMilliseconds = performance.now() - stageStartedAt;
      stageStartedAt = performance.now();
      const network = parseRoadNetwork(parsed);
      const validationDurationMilliseconds = performance.now() - stageStartedAt;
      stageStartedAt = performance.now();
      const index = new RoadSpatialIndex(network);
      const indexDurationMilliseconds = performance.now() - stageStartedAt;
      stageStartedAt = performance.now();
      router = new AStarRouter(network, index);
      const routerPreparationDurationMilliseconds =
        performance.now() - stageStartedAt;
      loadMetrics = {
        decodeDurationMilliseconds,
        parseDurationMilliseconds,
        validationDurationMilliseconds,
        indexDurationMilliseconds,
        routerPreparationDurationMilliseconds,
        totalDurationMilliseconds: performance.now() - startedAt,
        fileSizeBytes: message.buffer.byteLength,
        nodeCount: network.nodes.length,
        edgeCount: network.edges.length,
      };
      post({
        type: 'road-network-ready',
        requestId: message.requestId,
        metrics: loadMetrics,
      });
    } catch (error) {
      router = null;
      post({
        type: 'road-worker-error',
        requestId: message.requestId,
        operation: 'load',
        message: messageFor(error),
      });
    }
    return;
  }

  if (!router) {
    post({
      type: 'road-worker-error',
      requestId: message.requestId,
      operation: 'route',
      message: 'La red vial todavía no está preparada.',
    });
    return;
  }

  if (canceledRouteIds.delete(message.requestId)) return;
  try {
    const startedAt = performance.now();
    const route = router.getRoute(message.request);
    const durationMilliseconds = performance.now() - startedAt;
    const diagnostics: RoutingDiagnostics = router.getDiagnostics();
    if (canceledRouteIds.delete(message.requestId)) return;
    post({
      type: 'route-calculated',
      requestId: message.requestId,
      route,
      durationMilliseconds,
      diagnostics,
    });
  } catch (error) {
    post({
      type: 'road-worker-error',
      requestId: message.requestId,
      operation: 'route',
      message: messageFor(error),
    });
  }
};

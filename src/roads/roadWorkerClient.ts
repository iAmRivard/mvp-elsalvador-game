import { routingConfig } from '../config/routing.config';
import type {
  RouteRequest,
  RouteResult,
  RoutingDiagnostics,
} from '../types/routing';
import { copyRoadNetworkBuffer } from './roadNetwork';
import type {
  RoadNetworkReadyResponse,
  RoadWorkerLoadMetrics,
  RoadWorkerRequest,
  RoadWorkerResponse,
  RouteCalculatedResponse,
} from './roadWorkerProtocol';

export class RoadWorkerUnavailableError extends Error {}
export class RoadWorkerTimeoutError extends Error {}
export class RoadWorkerStaleResponseError extends Error {}

interface PendingRequest {
  resolve: (response: RoadWorkerResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface RoadWorkerClientDiagnostics {
  staleResponses: number;
  timeouts: number;
  lastRouteDurationMilliseconds: number | null;
  lastRoutingDiagnostics: RoutingDiagnostics | null;
  loadMetrics: RoadWorkerLoadMetrics | null;
}

interface RoadWorkerClientOptions {
  workerFactory?: () => Worker;
  bufferLoader?: () => Promise<ArrayBuffer>;
  timeoutMilliseconds?: number;
}

export class RoadWorkerClient {
  private readonly workerFactory: () => Worker;
  private readonly bufferLoader: () => Promise<ArrayBuffer>;
  private readonly timeoutMilliseconds: number;
  private readonly workerSupported: boolean;
  private worker: Worker | null = null;
  private loadPromise: Promise<RoadWorkerLoadMetrics> | null = null;
  private activeRouteRequestId: string | null = null;
  private requestSequence = 0;
  private readonly pending = new Map<string, PendingRequest>();
  private diagnostics: RoadWorkerClientDiagnostics = {
    staleResponses: 0,
    timeouts: 0,
    lastRouteDurationMilliseconds: null,
    lastRoutingDiagnostics: null,
    loadMetrics: null,
  };

  constructor(options: RoadWorkerClientOptions = {}) {
    this.workerSupported =
      options.workerFactory !== undefined || typeof Worker !== 'undefined';
    this.workerFactory =
      options.workerFactory ??
      (() =>
        new Worker(new URL('./road.worker.ts', import.meta.url), {
          type: 'module',
          name: 'road-routing',
        }));
    this.bufferLoader = options.bufferLoader ?? copyRoadNetworkBuffer;
    this.timeoutMilliseconds =
      options.timeoutMilliseconds ?? routingConfig.workerTimeoutMilliseconds;
  }

  preload(): Promise<RoadWorkerLoadMetrics> {
    this.loadPromise ??= this.load().catch((error: unknown) => {
      this.loadPromise = null;
      throw error;
    });
    return this.loadPromise;
  }

  async getRoute(request: RouteRequest): Promise<RouteResult | null> {
    await this.preload();
    if (this.activeRouteRequestId) {
      this.cancelRoute(this.activeRouteRequestId);
    }
    const requestId = this.nextRequestId('route');
    this.activeRouteRequestId = requestId;
    const response = (await this.send({
      type: 'calculate-route',
      requestId,
      request,
    })) as RouteCalculatedResponse;
    if (this.activeRouteRequestId !== requestId) {
      throw new RoadWorkerStaleResponseError(
        'La respuesta pertenece a una ruta reemplazada.',
      );
    }
    this.activeRouteRequestId = null;
    this.diagnostics.lastRouteDurationMilliseconds =
      response.durationMilliseconds;
    this.diagnostics.lastRoutingDiagnostics = response.diagnostics;
    return response.route;
  }

  getDiagnostics(): RoadWorkerClientDiagnostics {
    return { ...this.diagnostics };
  }

  dispose(): void {
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new RoadWorkerUnavailableError('Worker vial detenido.'));
      this.pending.delete(requestId);
    }
    this.worker?.removeEventListener('message', this.handleMessage);
    this.worker?.terminate();
    this.worker = null;
    this.loadPromise = null;
    this.activeRouteRequestId = null;
  }

  private async load(): Promise<RoadWorkerLoadMetrics> {
    const buffer = await this.bufferLoader();
    const requestId = this.nextRequestId('load');
    const response = (await this.send(
      { type: 'load-road-network', requestId, buffer },
      [buffer],
    )) as RoadNetworkReadyResponse;
    this.diagnostics.loadMetrics = response.metrics;
    return response.metrics;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    if (!this.workerSupported) {
      throw new RoadWorkerUnavailableError(
        'Este navegador no ofrece Web Workers.',
      );
    }
    try {
      this.worker = this.workerFactory();
      this.worker.addEventListener('message', this.handleMessage);
      return this.worker;
    } catch (error) {
      throw new RoadWorkerUnavailableError(
        error instanceof Error
          ? error.message
          : 'No se pudo iniciar el worker.',
      );
    }
  }

  private send(
    message: RoadWorkerRequest,
    transfer: Transferable[] = [],
  ): Promise<RoadWorkerResponse> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(message.requestId);
        if (this.activeRouteRequestId === message.requestId) {
          this.activeRouteRequestId = null;
          worker.postMessage({
            type: 'cancel-route',
            requestId: message.requestId,
          } satisfies RoadWorkerRequest);
        }
        this.diagnostics.timeouts += 1;
        reject(
          new RoadWorkerTimeoutError(
            `La operación vial superó ${String(this.timeoutMilliseconds)} ms.`,
          ),
        );
      }, this.timeoutMilliseconds);
      this.pending.set(message.requestId, { resolve, reject, timeout });
      try {
        worker.postMessage(message, transfer);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(message.requestId);
        reject(
          error instanceof Error
            ? error
            : new RoadWorkerUnavailableError('No se pudo contactar al worker.'),
        );
      }
    });
  }

  private cancelRoute(requestId: string): void {
    const pending = this.pending.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pending.delete(requestId);
      pending.reject(
        new RoadWorkerStaleResponseError('La ruta fue reemplazada por otra.'),
      );
    }
    this.worker?.postMessage({
      type: 'cancel-route',
      requestId,
    } satisfies RoadWorkerRequest);
    if (this.activeRouteRequestId === requestId) {
      this.activeRouteRequestId = null;
    }
  }

  private readonly handleMessage = (
    event: MessageEvent<RoadWorkerResponse>,
  ): void => {
    const response = event.data;
    const pending = this.pending.get(response.requestId);
    if (!pending) {
      this.diagnostics.staleResponses += 1;
      return;
    }
    clearTimeout(pending.timeout);
    this.pending.delete(response.requestId);
    if (response.type === 'road-worker-error') {
      if (this.activeRouteRequestId === response.requestId) {
        this.activeRouteRequestId = null;
      }
      pending.reject(new Error(response.message));
      return;
    }
    pending.resolve(response);
  };

  private nextRequestId(prefix: string): string {
    this.requestSequence += 1;
    return `${prefix}-${String(this.requestSequence)}`;
  }
}

let defaultRoadWorkerClient: RoadWorkerClient | null = null;

export function getRoadWorkerClient(): RoadWorkerClient | null {
  if (typeof Worker === 'undefined') return null;
  defaultRoadWorkerClient ??= new RoadWorkerClient();
  return defaultRoadWorkerClient;
}

export async function preloadRoadWorker(): Promise<RoadWorkerLoadMetrics | null> {
  return (await getRoadWorkerClient()?.preload()) ?? null;
}

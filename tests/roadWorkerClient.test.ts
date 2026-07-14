import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RoadWorkerClient,
  RoadWorkerStaleResponseError,
  RoadWorkerTimeoutError,
} from '../src/roads/roadWorkerClient';
import type {
  RoadWorkerLoadMetrics,
  RoadWorkerRequest,
  RoadWorkerResponse,
} from '../src/roads/roadWorkerProtocol';
import type { RouteRequest, RouteResult } from '../src/types/routing';

const loadMetrics: RoadWorkerLoadMetrics = {
  decodeDurationMilliseconds: 1,
  parseDurationMilliseconds: 2,
  validationDurationMilliseconds: 1,
  indexDurationMilliseconds: 3,
  routerPreparationDurationMilliseconds: 2,
  totalDurationMilliseconds: 9,
  fileSizeBytes: 256,
  nodeCount: 4,
  edgeCount: 3,
};

const routeRequest: RouteRequest = {
  origin: [-89.3, 13.7],
  destination: [-89.298, 13.7],
};

const routeResult: RouteResult = {
  coordinates: [routeRequest.origin, routeRequest.destination],
  distanceMeters: 200,
  estimatedGameDurationSeconds: 2,
  edgeIds: [0, 1],
};

class FakeRoadWorker {
  readonly posted: RoadWorkerRequest[] = [];
  private readonly listeners = new Set<
    (event: MessageEvent<RoadWorkerResponse>) => void
  >();
  onPost: ((message: RoadWorkerRequest) => void) | null = null;

  postMessage(message: RoadWorkerRequest): void {
    this.posted.push(message);
    this.onPost?.(message);
  }

  addEventListener(
    _type: string,
    listener: (event: MessageEvent<RoadWorkerResponse>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: string,
    listener: (event: MessageEvent<RoadWorkerResponse>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  terminate(): void {}

  emit(response: RoadWorkerResponse): void {
    const event = { data: response } as MessageEvent<RoadWorkerResponse>;
    for (const listener of this.listeners) listener(event);
  }
}

function clientFor(fakeWorker: FakeRoadWorker, timeoutMilliseconds = 100) {
  fakeWorker.onPost = (message) => {
    if (message.type === 'load-road-network') {
      queueMicrotask(() =>
        fakeWorker.emit({
          type: 'road-network-ready',
          requestId: message.requestId,
          metrics: loadMetrics,
        }),
      );
    }
  };
  return new RoadWorkerClient({
    workerFactory: () => fakeWorker as unknown as Worker,
    bufferLoader: () => Promise.resolve(new ArrayBuffer(256)),
    timeoutMilliseconds,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('road worker client', () => {
  it('discards a stale route after a newer request replaces it', async () => {
    const worker = new FakeRoadWorker();
    const client = clientFor(worker);
    await client.preload();

    const firstPromise = client.getRoute(routeRequest);
    const firstOutcome = firstPromise.catch((error: unknown) => error);
    await Promise.resolve();
    const firstRequest = worker.posted.find(
      (message) => message.type === 'calculate-route',
    );
    if (!firstRequest) throw new Error('First route request was not sent.');

    const secondPromise = client.getRoute({
      ...routeRequest,
      destination: [-89.299, 13.701],
    });
    await Promise.resolve();
    const routeRequests = worker.posted.filter(
      (message) => message.type === 'calculate-route',
    );
    const secondRequest = routeRequests.at(-1);
    if (!secondRequest) throw new Error('Second route request was not sent.');
    worker.emit({
      type: 'route-calculated',
      requestId: secondRequest.requestId,
      route: routeResult,
      durationMilliseconds: 12,
      diagnostics: {
        calculations: 1,
        cacheHits: 0,
        cacheEntries: 1,
        averageDurationMilliseconds: 12,
        lastDurationMilliseconds: 12,
        lastExpandedNodeCount: 8,
      },
    });

    await expect(secondPromise).resolves.toEqual(routeResult);
    expect(await firstOutcome).toBeInstanceOf(RoadWorkerStaleResponseError);

    worker.emit({
      type: 'route-calculated',
      requestId: firstRequest.requestId,
      route: routeResult,
      durationMilliseconds: 20,
      diagnostics: {
        calculations: 2,
        cacheHits: 0,
        cacheEntries: 2,
        averageDurationMilliseconds: 16,
        lastDurationMilliseconds: 20,
        lastExpandedNodeCount: 12,
      },
    });
    expect(client.getDiagnostics().staleResponses).toBe(1);
    client.dispose();
  });

  it('times out and sends logical cancellation when routing never answers', async () => {
    vi.useFakeTimers();
    const worker = new FakeRoadWorker();
    const client = clientFor(worker, 25);
    const preloadPromise = client.preload();
    vi.runAllTicks();
    await preloadPromise;

    const routePromise = client.getRoute(routeRequest);
    const routeOutcome = routePromise.catch((error: unknown) => error);
    vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(26);

    expect(await routeOutcome).toBeInstanceOf(RoadWorkerTimeoutError);
    expect(
      worker.posted.some((message) => message.type === 'cancel-route'),
    ).toBe(true);
    expect(client.getDiagnostics().timeouts).toBe(1);
    client.dispose();
  });
});

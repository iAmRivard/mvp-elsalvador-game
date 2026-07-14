import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseRoadNetwork } from '../src/roads/roadNetwork';
import { createRoadTestNetwork } from './roadTestNetwork';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('road network parser', () => {
  it('accepts the compact local road schema', () => {
    const network = createRoadTestNetwork();
    expect(parseRoadNetwork(network)).toBe(network);
  });

  it('rejects malformed edges before building the spatial index', () => {
    const network = createRoadTestNetwork();
    const malformed = {
      ...network,
      edges: [{ ...network.edges[0], roadClass: 'footway' }],
    };
    expect(() => parseRoadNetwork(malformed)).toThrow(/formato incompatible/i);
  });

  it('downloads once, shares preparation and reports stage metrics', async () => {
    const serialized = JSON.stringify(createRoadTestNetwork());
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(serialized, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { copyRoadNetworkBuffer, loadRoadNetwork } =
      await import('../src/roads/roadNetwork');

    const [first, second, copiedBuffer] = await Promise.all([
      loadRoadNetwork(),
      loadRoadNetwork(),
      copyRoadNetworkBuffer(),
    ]);

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(copiedBuffer.byteLength).toBe(first.fileSizeBytes);
    expect(first.metrics).toMatchObject({
      nodeCount: 4,
      edgeCount: 3,
      fileSizeBytes: first.fileSizeBytes,
    });
    expect(first.metrics.totalDurationMilliseconds).toBeGreaterThanOrEqual(0);
    expect(first.metrics.approximateMemoryBytes).toBeGreaterThan(
      first.fileSizeBytes,
    );
  });
});

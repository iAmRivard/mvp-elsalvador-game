import { describe, expect, it } from 'vitest';
import { parseRoadNetwork } from '../src/roads/roadNetwork';
import { createRoadTestNetwork } from './roadTestNetwork';

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
});

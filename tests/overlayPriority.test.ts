import { describe, expect, it } from 'vitest';
import {
  resolveOverlayQueue,
  type OverlayCandidate,
} from '../src/ui/overlayPriority';

const candidates: OverlayCandidate[] = [
  {
    id: 'discovery:city',
    kind: 'discovery',
    priority: 'discovery',
    large: true,
    sequence: 4,
  },
  {
    id: 'radio:signal',
    kind: 'radio',
    priority: 'radio',
    large: true,
    sequence: 3,
  },
  {
    id: 'narrative:chapter',
    kind: 'narrative',
    priority: 'narrative',
    large: true,
    sequence: 2,
  },
];

describe('overlay priority queue', () => {
  it('selects one large overlay in deterministic priority order', () => {
    const result = resolveOverlayQueue(candidates);

    expect(result.activeLarge?.kind).toBe('narrative');
    expect(result.queuedLarge.map((candidate) => candidate.kind)).toEqual([
      'radio',
      'discovery',
    ]);
  });

  it('converts discovery to compact presentation while radio is active', () => {
    const result = resolveOverlayQueue(
      candidates.filter((candidate) => candidate.kind !== 'narrative'),
    );

    expect(result.activeLarge?.kind).toBe('radio');
    expect(result.compact.map((candidate) => candidate.kind)).toEqual([
      'discovery',
    ]);
  });

  it('uses critical sequence before lower priorities', () => {
    const result = resolveOverlayQueue([
      ...candidates,
      {
        id: 'choice:required',
        kind: 'mission-choice',
        priority: 'critical',
        large: true,
        sequence: 1,
      },
      {
        id: 'recovery:fuel',
        kind: 'recovery',
        priority: 'critical',
        large: true,
        sequence: 0,
      },
    ]);

    expect(result.activeLarge?.kind).toBe('recovery');
    expect(result.queuedLarge[0]?.kind).toBe('mission-choice');
  });
});

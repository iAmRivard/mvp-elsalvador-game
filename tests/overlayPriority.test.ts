import { describe, expect, it } from 'vitest';
import {
  resolveOverlayQueue,
  type OverlayCandidate,
} from '../src/ui/overlayPriority';

const narrative: OverlayCandidate = {
  id: 'narrative:chapter',
  kind: 'narrative',
  priority: 'narrative',
  large: true,
  sequence: 0,
};
const tutorial: OverlayCandidate = {
  id: 'tutorial:mandatory',
  kind: 'tutorial',
  priority: 'tutorial',
  large: true,
  sequence: 3,
};
const expandedRadio: OverlayCandidate = {
  id: 'radio:signal',
  kind: 'radio',
  priority: 'radio',
  large: true,
  sequence: 4,
};
const compactRadio: OverlayCandidate = {
  ...expandedRadio,
  priority: 'compact-radio',
  large: false,
};
const objectiveAdvice: OverlayCandidate = {
  id: 'advice:objective',
  kind: 'contextual-advice',
  priority: 'information',
  large: false,
  sequence: 5,
};
const interactionAdvice: OverlayCandidate = {
  ...objectiveAdvice,
  id: 'advice:interaction',
  priority: 'interaction',
};
const discovery: OverlayCandidate = {
  id: 'discovery:city',
  kind: 'discovery',
  priority: 'discovery',
  large: true,
  sequence: 6,
};

function kinds(candidates: readonly OverlayCandidate[]): string[] {
  return candidates.map((candidate) => candidate.kind);
}

describe('overlay priority queue', () => {
  it('queues expanded radio behind narrative', () => {
    const result = resolveOverlayQueue([expandedRadio, narrative]);

    expect(result.activeLarge?.kind).toBe('narrative');
    expect(kinds(result.queuedLarge)).toEqual(['radio']);
    expect(result.compact).toEqual([]);
  });

  it('queues expanded radio behind mandatory tutorial', () => {
    const result = resolveOverlayQueue([expandedRadio, tutorial]);

    expect(result.activeLarge?.kind).toBe('tutorial');
    expect(kinds(result.queuedLarge)).toEqual(['radio']);
    expect(result.compact).toEqual([]);
  });

  it('keeps compact radio below objective advice', () => {
    const result = resolveOverlayQueue([compactRadio, objectiveAdvice]);

    expect(result.activeLarge).toBeNull();
    expect(result.queuedLarge).toEqual([]);
    expect(kinds(result.compact)).toEqual(['contextual-advice', 'radio']);
  });

  it('keeps interaction ahead of compact radio and information', () => {
    const result = resolveOverlayQueue([
      compactRadio,
      objectiveAdvice,
      interactionAdvice,
    ]);

    expect(kinds(result.compact)).toEqual([
      'contextual-advice',
      'contextual-advice',
      'radio',
    ]);
    expect(result.compact[0]?.id).toBe('advice:interaction');
  });

  it('keeps advice compact while expanded radio owns the large slot', () => {
    const result = resolveOverlayQueue([expandedRadio, objectiveAdvice]);

    expect(result.activeLarge?.kind).toBe('radio');
    expect(kinds(result.compact)).toEqual(['contextual-advice']);
  });

  it('keeps compact radio available while recovery owns the large slot', () => {
    const recovery: OverlayCandidate = {
      id: 'recovery:fuel',
      kind: 'recovery',
      priority: 'critical',
      large: true,
      sequence: 1,
    };
    const result = resolveOverlayQueue([compactRadio, recovery]);

    expect(result.activeLarge?.kind).toBe('recovery');
    expect(result.queuedLarge).toEqual([]);
    expect(kinds(result.compact)).toEqual(['radio']);
  });

  it('downgrades discovery to a disjoint compact slot under expanded radio', () => {
    const result = resolveOverlayQueue([discovery, expandedRadio]);

    expect(result.activeLarge?.kind).toBe('radio');
    expect(result.queuedLarge).toEqual([]);
    expect(kinds(result.compact)).toEqual(['discovery']);
  });

  it('uses sequence and then id for candidates with the same priority', () => {
    const result = resolveOverlayQueue([
      {
        id: 'choice:z',
        kind: 'mission-choice',
        priority: 'critical',
        large: true,
        sequence: 2,
      },
      {
        id: 'recovery:a',
        kind: 'recovery',
        priority: 'critical',
        large: true,
        sequence: 1,
      },
    ]);

    expect(result.activeLarge?.kind).toBe('recovery');
    expect(kinds(result.queuedLarge)).toEqual(['mission-choice']);
  });

  it('moves radio from activeLarge to compact when its mode changes', () => {
    const expanded = resolveOverlayQueue([expandedRadio]);
    const compact = resolveOverlayQueue([compactRadio]);

    expect(expanded.activeLarge?.kind).toBe('radio');
    expect(expanded.compact).toEqual([]);
    expect(compact.activeLarge).toBeNull();
    expect(kinds(compact.compact)).toEqual(['radio']);
  });
});

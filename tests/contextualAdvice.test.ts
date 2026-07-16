import { describe, expect, it } from 'vitest';
import {
  selectContextualAdvice,
  type ContextualAdviceId,
} from '../src/game/contextualAdvice';

const emptySeen = new Set<ContextualAdviceId>();

describe('contextual advice', () => {
  it('shows the objective only when it is relevant', () => {
    expect(
      selectContextualAdvice(
        {
          interactionLabel: null,
          objectiveRelevant: false,
          journalHasNewContent: false,
          boostIsSafe: false,
        },
        emptySeen,
      ),
    ).toBeNull();
    expect(
      selectContextualAdvice(
        {
          interactionLabel: null,
          objectiveRelevant: true,
          journalHasNewContent: false,
          boostIsSafe: false,
        },
        emptySeen,
      )?.id,
    ).toBe('objective');
  });

  it('prioritizes interaction and keeps boost behind objective context', () => {
    expect(
      selectContextualAdvice(
        {
          interactionLabel: 'Sintonizar',
          objectiveRelevant: true,
          journalHasNewContent: true,
          boostIsSafe: true,
        },
        emptySeen,
      )?.id,
    ).toBe('interaction');
    expect(
      selectContextualAdvice(
        {
          interactionLabel: null,
          objectiveRelevant: true,
          journalHasNewContent: false,
          boostIsSafe: true,
        },
        emptySeen,
      )?.id,
    ).toBe('objective');
  });

  it('does not select an advice item already seen in the session', () => {
    const seen = new Set<ContextualAdviceId>(['interaction', 'objective']);
    expect(
      selectContextualAdvice(
        {
          interactionLabel: 'Sintonizar',
          objectiveRelevant: true,
          journalHasNewContent: true,
          boostIsSafe: true,
        },
        seen,
      )?.id,
    ).toBe('boost');
  });
});

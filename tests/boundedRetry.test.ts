import { describe, expect, it } from 'vitest';
import {
  boundedRetryDelayMilliseconds,
  initialBoundedRetryState,
  scheduleBoundedRetry,
  settleBoundedRetry,
} from '../src/map/boundedRetry';

describe('bounded route retry', () => {
  it('does not overlap a pending attempt', () => {
    const first = scheduleBoundedRetry(initialBoundedRetryState(), 3);
    expect(first).not.toBeNull();
    expect(scheduleBoundedRetry(first!.state, 3)).toBeNull();
  });

  it('stops after the configured maximum', () => {
    let state = initialBoundedRetryState();
    for (const expectedAttempt of [1, 2, 3]) {
      const scheduled = scheduleBoundedRetry(state, 3);
      expect(scheduled?.attempt).toBe(expectedAttempt);
      state = settleBoundedRetry(scheduled!.state);
    }
    expect(scheduleBoundedRetry(state, 3)).toBeNull();
  });

  it('settles cancellation without consuming another attempt', () => {
    const scheduled = scheduleBoundedRetry(initialBoundedRetryState(), 3)!;
    expect(settleBoundedRetry(scheduled.state)).toEqual({
      attempts: 1,
      pending: false,
    });
    expect(initialBoundedRetryState()).toEqual({ attempts: 0, pending: false });
  });

  it('uses a bounded linear delay', () => {
    expect(boundedRetryDelayMilliseconds(500, 1)).toBe(500);
    expect(boundedRetryDelayMilliseconds(500, 3)).toBe(1_500);
    expect(boundedRetryDelayMilliseconds(-1, 0)).toBe(0);
  });
});

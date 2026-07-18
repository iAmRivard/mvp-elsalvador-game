export interface BoundedRetryState {
  attempts: number;
  pending: boolean;
}

export interface ScheduledBoundedRetry {
  attempt: number;
  state: BoundedRetryState;
}

export function initialBoundedRetryState(): BoundedRetryState {
  return { attempts: 0, pending: false };
}

export function scheduleBoundedRetry(
  state: BoundedRetryState,
  maximumAttempts: number,
): ScheduledBoundedRetry | null {
  const maximum = Math.max(0, Math.floor(maximumAttempts));
  if (state.pending || state.attempts >= maximum) return null;
  const attempt = state.attempts + 1;
  return {
    attempt,
    state: { attempts: attempt, pending: true },
  };
}

export function settleBoundedRetry(
  state: BoundedRetryState,
): BoundedRetryState {
  return state.pending ? { ...state, pending: false } : state;
}

export function boundedRetryDelayMilliseconds(
  baseDelayMilliseconds: number,
  attempt: number,
): number {
  return Math.max(0, baseDelayMilliseconds) * Math.max(1, Math.floor(attempt));
}

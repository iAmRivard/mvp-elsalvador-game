export interface TrailingUpdateScheduler<T> {
  schedule: (value: T) => void;
  cancel: () => void;
}

export function createTrailingUpdateScheduler<T>(
  intervalMilliseconds: number,
  apply: (value: T) => void,
  now: () => number = () => performance.now(),
): TrailingUpdateScheduler<T> {
  let lastAppliedAt = Number.NEGATIVE_INFINITY;
  let pending: T | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const applyPending = () => {
    timer = null;
    if (pending === undefined) return;
    const value = pending;
    pending = undefined;
    lastAppliedAt = now();
    apply(value);
  };

  const cancel = () => {
    pending = undefined;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    schedule: (value) => {
      const currentTime = now();
      const elapsed = currentTime - lastAppliedAt;
      if (elapsed >= intervalMilliseconds) {
        cancel();
        lastAppliedAt = currentTime;
        apply(value);
        return;
      }

      pending = value;
      if (timer !== null) return;
      timer = setTimeout(
        applyPending,
        Math.max(0, intervalMilliseconds - elapsed),
      );
    },
    cancel,
  };
}

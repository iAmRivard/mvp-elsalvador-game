export type CameraCadenceHertz = 20 | 30 | 45 | 60;

export interface CameraPerformanceWindow {
  durationMilliseconds: number;
  frameCount: number;
  frametimeP95Milliseconds: number;
  framesOver50Milliseconds: number;
  framesOver100Milliseconds: number;
  cameraP95Milliseconds: number;
}

export interface AdaptiveCameraCadenceState {
  hertz: CameraCadenceHertz;
  consecutiveHealthyWindows: number;
  consecutiveUnhealthyWindows: number;
}

export const initialAdaptiveCameraCadence: AdaptiveCameraCadenceState = {
  hertz: 30,
  consecutiveHealthyWindows: 0,
  consecutiveUnhealthyWindows: 0,
};

const promotionFrametimeP95ByCadence: Readonly<
  Record<CameraCadenceHertz, number>
> = {
  20: 24,
  30: 20,
  45: 14,
  60: 0,
};

function nextHigherCadence(hertz: CameraCadenceHertz): CameraCadenceHertz {
  if (hertz === 20) return 30;
  return hertz === 30 ? 45 : 60;
}

function nextLowerCadence(hertz: CameraCadenceHertz): CameraCadenceHertz {
  if (hertz === 60) return 45;
  return hertz === 45 ? 30 : 20;
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
  ];
}

export function cameraCadenceIntervalMilliseconds(
  hertz: CameraCadenceHertz,
): number {
  return 1_000 / hertz;
}

export function cameraCadenceShouldApply(
  timestampMilliseconds: number,
  nextDeadlineMilliseconds: number,
): boolean {
  return (
    !Number.isFinite(nextDeadlineMilliseconds) ||
    nextDeadlineMilliseconds <= 0 ||
    timestampMilliseconds + 0.001 >= nextDeadlineMilliseconds
  );
}

export function cameraCadenceDeadlineAfterApplication(
  currentDeadlineMilliseconds: number,
  timestampMilliseconds: number,
  intervalMilliseconds: number,
): number {
  if (
    !Number.isFinite(timestampMilliseconds) ||
    !Number.isFinite(intervalMilliseconds) ||
    intervalMilliseconds <= 0
  ) {
    return timestampMilliseconds;
  }
  if (
    !Number.isFinite(currentDeadlineMilliseconds) ||
    currentDeadlineMilliseconds <= 0 ||
    timestampMilliseconds - currentDeadlineMilliseconds >
      Math.max(250, intervalMilliseconds * 4)
  ) {
    return timestampMilliseconds + intervalMilliseconds;
  }
  let nextDeadline = currentDeadlineMilliseconds;
  do {
    nextDeadline += intervalMilliseconds;
  } while (nextDeadline <= timestampMilliseconds);
  return nextDeadline;
}

export function adaptiveCameraCadenceFor(
  state: AdaptiveCameraCadenceState,
  window: CameraPerformanceWindow,
  maximumHertz: CameraCadenceHertz = 60,
): AdaptiveCameraCadenceState {
  const completeWindow =
    Number.isFinite(window.durationMilliseconds) &&
    window.durationMilliseconds >= 4_000 &&
    Number.isFinite(window.frameCount) &&
    window.frameCount > 0;
  if (!completeWindow) return state;

  const healthy =
    state.hertz < maximumHertz &&
    window.frametimeP95Milliseconds <=
      promotionFrametimeP95ByCadence[state.hertz] &&
    window.framesOver50Milliseconds === 0 &&
    window.framesOver100Milliseconds === 0 &&
    window.cameraP95Milliseconds < 2.5;
  const unhealthy =
    window.frametimeP95Milliseconds > 28 ||
    window.framesOver50Milliseconds > 0 ||
    window.framesOver100Milliseconds > 0 ||
    window.cameraP95Milliseconds >= 3;

  if (healthy) {
    const consecutiveHealthyWindows = state.consecutiveHealthyWindows + 1;
    if (consecutiveHealthyWindows >= 3) {
      const nextHertz = nextHigherCadence(state.hertz);
      return {
        hertz: nextHertz > maximumHertz ? maximumHertz : nextHertz,
        consecutiveHealthyWindows: 0,
        consecutiveUnhealthyWindows: 0,
      };
    }
    return {
      ...state,
      consecutiveHealthyWindows,
      consecutiveUnhealthyWindows: 0,
    };
  }

  if (unhealthy) {
    const consecutiveUnhealthyWindows = state.consecutiveUnhealthyWindows + 1;
    if (consecutiveUnhealthyWindows >= 2 && state.hertz > 30) {
      return {
        hertz: nextLowerCadence(state.hertz),
        consecutiveHealthyWindows: 0,
        consecutiveUnhealthyWindows: 0,
      };
    }
    return {
      ...state,
      consecutiveHealthyWindows: 0,
      consecutiveUnhealthyWindows,
    };
  }

  return {
    ...state,
    consecutiveHealthyWindows: 0,
    consecutiveUnhealthyWindows: 0,
  };
}

interface AdaptiveCameraCadenceControllerOptions {
  initialHertz: CameraCadenceHertz;
  maximumHertz: CameraCadenceHertz;
  windowDurationMilliseconds?: number;
}

export class AdaptiveCameraCadenceController {
  private currentState: AdaptiveCameraCadenceState;
  private readonly maximumHertz: CameraCadenceHertz;
  private readonly windowDurationMilliseconds: number;
  private windowStartedAt: number | null = null;
  private lastFrameAt: number | null = null;
  private frameDurations: number[] = [];
  private cameraDurations: number[] = [];
  private framesOver50Milliseconds = 0;
  private framesOver100Milliseconds = 0;
  private completedWindow: CameraPerformanceWindow | null = null;

  constructor(options: AdaptiveCameraCadenceControllerOptions) {
    this.currentState = {
      hertz: options.initialHertz,
      consecutiveHealthyWindows: 0,
      consecutiveUnhealthyWindows: 0,
    };
    this.maximumHertz = options.maximumHertz;
    this.windowDurationMilliseconds = Math.max(
      4_000,
      options.windowDurationMilliseconds ?? 5_000,
    );
  }

  get state(): AdaptiveCameraCadenceState {
    return this.currentState;
  }

  get intervalMilliseconds(): number {
    return cameraCadenceIntervalMilliseconds(this.currentState.hertz);
  }

  get lastCompletedWindow(): CameraPerformanceWindow | null {
    return this.completedWindow;
  }

  ensureMinimumHertz(minimumHertz: CameraCadenceHertz): boolean {
    if (this.currentState.hertz >= minimumHertz) return false;
    this.currentState = {
      hertz: minimumHertz,
      consecutiveHealthyWindows: 0,
      consecutiveUnhealthyWindows: 0,
    };
    return true;
  }

  resetSampling(timestampMilliseconds?: number): void {
    const timestamp =
      timestampMilliseconds !== undefined &&
      Number.isFinite(timestampMilliseconds)
        ? timestampMilliseconds
        : null;
    this.currentState = {
      ...this.currentState,
      consecutiveHealthyWindows: 0,
      consecutiveUnhealthyWindows: 0,
    };
    this.windowStartedAt = timestamp;
    this.lastFrameAt = timestamp;
    this.frameDurations = [];
    this.cameraDurations = [];
    this.framesOver50Milliseconds = 0;
    this.framesOver100Milliseconds = 0;
    this.completedWindow = null;
  }

  recordCameraUpdate(durationMilliseconds: number): void {
    if (Number.isFinite(durationMilliseconds) && durationMilliseconds >= 0) {
      this.cameraDurations.push(durationMilliseconds);
    }
  }

  recordVisualFrame(
    timestampMilliseconds: number,
  ): CameraPerformanceWindow | null {
    if (!Number.isFinite(timestampMilliseconds)) return null;
    if (this.windowStartedAt === null || this.lastFrameAt === null) {
      this.windowStartedAt = timestampMilliseconds;
      this.lastFrameAt = timestampMilliseconds;
      return null;
    }

    const frameDuration = timestampMilliseconds - this.lastFrameAt;
    this.lastFrameAt = timestampMilliseconds;
    if (frameDuration > 0) {
      this.frameDurations.push(Math.min(frameDuration, 1_000));
      if (frameDuration > 50) this.framesOver50Milliseconds += 1;
      if (frameDuration > 100) this.framesOver100Milliseconds += 1;
    }

    const durationMilliseconds = timestampMilliseconds - this.windowStartedAt;
    if (durationMilliseconds < this.windowDurationMilliseconds) return null;

    const window: CameraPerformanceWindow = {
      durationMilliseconds,
      frameCount: this.frameDurations.length,
      frametimeP95Milliseconds: percentile95(this.frameDurations),
      framesOver50Milliseconds: this.framesOver50Milliseconds,
      framesOver100Milliseconds: this.framesOver100Milliseconds,
      cameraP95Milliseconds: percentile95(this.cameraDurations),
    };
    this.currentState = adaptiveCameraCadenceFor(
      this.currentState,
      window,
      this.maximumHertz,
    );
    this.completedWindow = window;
    this.windowStartedAt = timestampMilliseconds;
    this.frameDurations = [];
    this.cameraDurations = [];
    this.framesOver50Milliseconds = 0;
    this.framesOver100Milliseconds = 0;
    return window;
  }
}

export type DrivingPresentationMode =
  'stopped' | 'driving' | 'fast' | 'alert' | 'interaction';

export interface DrivingPresentationInput {
  speedKilometersPerHour: number;
  hasCriticalFuelAlert: boolean;
  hasCriticalConditionAlert: boolean;
  hasCriticalTimerAlert?: boolean;
  hasInteraction: boolean;
  isPaused: boolean;
  isJournalOpen: boolean;
  activeBlockingOverlay: boolean;
  previousMode?: DrivingPresentationMode;
  stoppedForMilliseconds?: number;
}

export const drivingPresentationThresholds = {
  stoppedEnterKilometersPerHour: 4.25,
  stoppedExitKilometersPerHour: 6,
  stoppedDelayMilliseconds: 1_250,
  fastEnterKilometersPerHour: 58,
  fastExitKilometersPerHour: 52,
  interactionMaximumKilometersPerHour: 8,
} as const;

function normalizedSpeed(speedKilometersPerHour: number): number {
  return Number.isFinite(speedKilometersPerHour)
    ? Math.abs(speedKilometersPerHour)
    : 0;
}

export function deriveDrivingPresentationMode(
  input: DrivingPresentationInput,
): DrivingPresentationMode {
  const speed = normalizedSpeed(input.speedKilometersPerHour);
  if (
    input.hasCriticalFuelAlert ||
    input.hasCriticalConditionAlert ||
    input.hasCriticalTimerAlert ||
    input.activeBlockingOverlay
  ) {
    return 'alert';
  }
  if (
    input.hasInteraction &&
    speed <= drivingPresentationThresholds.interactionMaximumKilometersPerHour
  ) {
    return 'interaction';
  }
  if (input.isPaused) return 'stopped';

  const previous = input.previousMode ?? 'stopped';
  const stoppedFor = input.stoppedForMilliseconds ?? Number.POSITIVE_INFINITY;
  if (
    previous === 'stopped' &&
    speed < drivingPresentationThresholds.stoppedExitKilometersPerHour
  ) {
    return 'stopped';
  }
  if (
    speed < drivingPresentationThresholds.stoppedEnterKilometersPerHour &&
    stoppedFor >= drivingPresentationThresholds.stoppedDelayMilliseconds
  ) {
    return 'stopped';
  }

  const fastThreshold =
    previous === 'fast'
      ? drivingPresentationThresholds.fastExitKilometersPerHour
      : drivingPresentationThresholds.fastEnterKilometersPerHour;
  return speed > fastThreshold ? 'fast' : 'driving';
}

export class DrivingPresentationController {
  private mode: DrivingPresentationMode = 'stopped';
  private belowStoppedThresholdSince: number | null = null;

  update(
    input: DrivingPresentationInput,
    timestampMilliseconds: number,
  ): DrivingPresentationMode {
    const now = Number.isFinite(timestampMilliseconds)
      ? timestampMilliseconds
      : 0;
    const speed = normalizedSpeed(input.speedKilometersPerHour);
    if (speed < drivingPresentationThresholds.stoppedEnterKilometersPerHour) {
      this.belowStoppedThresholdSince ??= now;
    } else if (
      speed >= drivingPresentationThresholds.stoppedExitKilometersPerHour
    ) {
      this.belowStoppedThresholdSince = null;
    }
    const stoppedForMilliseconds =
      this.belowStoppedThresholdSince === null
        ? 0
        : Math.max(0, now - this.belowStoppedThresholdSince);
    this.mode = deriveDrivingPresentationMode({
      ...input,
      previousMode: this.mode,
      stoppedForMilliseconds,
    });
    return this.mode;
  }

  reset(mode: DrivingPresentationMode = 'stopped'): void {
    this.mode = mode;
    this.belowStoppedThresholdSince = null;
  }

  getMode(): DrivingPresentationMode {
    return this.mode;
  }
}

export function drivingDeclutterMode(
  mode: DrivingPresentationMode,
): 'stopped' | 'driving' | 'fast' {
  if (mode === 'fast') return 'fast';
  if (mode === 'driving' || mode === 'alert') return 'driving';
  return 'stopped';
}

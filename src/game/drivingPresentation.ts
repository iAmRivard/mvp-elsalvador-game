import { roadSurfaceLabels } from '../config/roadHandling.config';
import type { RecoveryReason } from '../types/progression';
import type { RoadSurface } from '../types/roads';

export type DrivingPresentationMode =
  'stopped' | 'driving' | 'fast' | 'alert' | 'interaction';

/**
 * Complete store state that can change the driving presentation. Keeping this
 * contract explicit prevents blocking overlays from waiting for telemetry.
 */
export interface PresentationRelevantState {
  speedKilometersPerHour: number;
  isPaused: boolean;
  isJournalOpen: boolean;
  recoveryReason: RecoveryReason | null;
  activeNarrativeEventId: string | null;
  activeMissionChoiceObjectiveId: string | null;
  hasCriticalFuelAlert: boolean;
  hasCriticalConditionAlert: boolean;
  hasCriticalTimerAlert: boolean;
  hasInteraction: boolean;
}

/** Backward-compatible input accepted by existing callers and focused tests. */
export interface DrivingPresentationInput {
  speedKilometersPerHour: number;
  hasCriticalFuelAlert: boolean;
  hasCriticalConditionAlert: boolean;
  hasCriticalTimerAlert?: boolean;
  hasInteraction: boolean;
  isPaused: boolean;
  isJournalOpen: boolean;
  recoveryReason?: RecoveryReason | null;
  activeNarrativeEventId?: string | null;
  activeMissionChoiceObjectiveId?: string | null;
  activeBlockingOverlay?: boolean;
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

function relevantStateFromInput(
  input: DrivingPresentationInput | PresentationRelevantState,
): PresentationRelevantState {
  return {
    speedKilometersPerHour: input.speedKilometersPerHour,
    isPaused: input.isPaused,
    isJournalOpen: input.isJournalOpen,
    recoveryReason: input.recoveryReason ?? null,
    activeNarrativeEventId: input.activeNarrativeEventId ?? null,
    activeMissionChoiceObjectiveId:
      input.activeMissionChoiceObjectiveId ?? null,
    hasCriticalFuelAlert: input.hasCriticalFuelAlert,
    hasCriticalConditionAlert: input.hasCriticalConditionAlert,
    hasCriticalTimerAlert: input.hasCriticalTimerAlert ?? false,
    hasInteraction: input.hasInteraction,
  };
}

function blockingPresentation(
  state: PresentationRelevantState,
  legacyBlockingOverlay = false,
): DrivingPresentationMode | null {
  if (
    state.hasCriticalFuelAlert ||
    state.hasCriticalConditionAlert ||
    state.hasCriticalTimerAlert ||
    state.isJournalOpen ||
    state.recoveryReason !== null ||
    state.activeNarrativeEventId !== null ||
    state.activeMissionChoiceObjectiveId !== null ||
    legacyBlockingOverlay
  ) {
    return 'alert';
  }
  if (state.isPaused) return 'stopped';
  if (
    state.hasInteraction &&
    normalizedSpeed(state.speedKilometersPerHour) <=
      drivingPresentationThresholds.interactionMaximumKilometersPerHour
  ) {
    return 'interaction';
  }
  return null;
}

function movingPresentation(
  state: PresentationRelevantState,
  previousMode: DrivingPresentationMode,
  canEnterStopped: boolean,
  legacyBlockingOverlay = false,
): DrivingPresentationMode {
  const blocking = blockingPresentation(state, legacyBlockingOverlay);
  if (blocking) return blocking;

  const speed = normalizedSpeed(state.speedKilometersPerHour);
  if (
    previousMode === 'stopped' &&
    speed < drivingPresentationThresholds.stoppedExitKilometersPerHour
  ) {
    return 'stopped';
  }
  if (
    canEnterStopped &&
    speed < drivingPresentationThresholds.stoppedEnterKilometersPerHour
  ) {
    return 'stopped';
  }

  if (previousMode === 'fast') {
    return speed > drivingPresentationThresholds.fastExitKilometersPerHour
      ? 'fast'
      : 'driving';
  }
  return speed >= drivingPresentationThresholds.fastEnterKilometersPerHour
    ? 'fast'
    : 'driving';
}

export function derivePresentationFromState(
  state: PresentationRelevantState,
  previousMode: DrivingPresentationMode,
  timestampMilliseconds: number,
): DrivingPresentationMode {
  // The timestamp is part of the public contract so stateful controllers can
  // apply their stopped-delay clock without changing the derivation inputs.
  void timestampMilliseconds;
  return movingPresentation(state, previousMode, true);
}

export function deriveDrivingPresentationMode(
  input: DrivingPresentationInput,
): DrivingPresentationMode {
  const previousMode = input.previousMode ?? 'stopped';
  return movingPresentation(
    relevantStateFromInput(input),
    previousMode,
    (input.stoppedForMilliseconds ?? Number.POSITIVE_INFINITY) >=
      drivingPresentationThresholds.stoppedDelayMilliseconds,
    input.activeBlockingOverlay ?? false,
  );
}

export class DrivingPresentationController {
  private mode: DrivingPresentationMode = 'stopped';
  private belowStoppedThresholdSince: number | null = null;

  update(
    input: DrivingPresentationInput | PresentationRelevantState,
    timestampMilliseconds: number,
  ): DrivingPresentationMode {
    const now = Number.isFinite(timestampMilliseconds)
      ? timestampMilliseconds
      : 0;
    const state = relevantStateFromInput(input);
    const speed = normalizedSpeed(state.speedKilometersPerHour);
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
    this.mode = movingPresentation(
      state,
      this.mode,
      stoppedForMilliseconds >=
        drivingPresentationThresholds.stoppedDelayMilliseconds,
      'activeBlockingOverlay' in input
        ? (input.activeBlockingOverlay ?? false)
        : false,
    );
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

export function effectiveDrivingSurfaceLabel(
  surface: RoadSurface,
  insideValidObjectiveZone: boolean,
): string {
  return insideValidObjectiveZone
    ? 'Zona del objetivo'
    : roadSurfaceLabels[surface];
}

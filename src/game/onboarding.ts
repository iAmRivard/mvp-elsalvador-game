import type { InputDiagnostics } from './inputController';
import type { OnboardingState } from '../types/onboarding';
import type { RoadSurface } from '../types/roads';

export const onboardingStepIds = [
  'select-speed',
  'steer',
  'coast',
  'brake',
  'route',
] as const;

export type OnboardingStepId = (typeof onboardingStepIds)[number];

export function onboardingStateForStep(
  step: OnboardingStepId,
): OnboardingState {
  switch (step) {
    case 'steer':
      return 'driving-basics';
    case 'select-speed':
    case 'coast':
    case 'brake':
      return 'driving-basics';
    case 'route':
      return 'navigation-basics';
  }
}

export function onboardingStepIndexForState(
  state: OnboardingState,
): number | null {
  switch (state) {
    case 'driving-basics':
      return 0;
    case 'navigation-basics':
      return onboardingStepIds.indexOf('route');
    case 'not-started':
    case 'introducing':
    case 'interaction-basics':
    case 'completed':
    case 'skipped':
      return null;
  }
}

export function conventionalThrottleIntent(
  diagnostics: InputDiagnostics,
): number {
  return Math.max(
    -1,
    Math.min(
      1,
      diagnostics.keyboardThrottle +
        diagnostics.pointerThrottle +
        diagnostics.touchThrottle +
        diagnostics.joystickThrottle,
    ),
  );
}

export function coastConditionIsMet(
  diagnostics: InputDiagnostics,
  speedKilometersPerHour: number,
): boolean {
  if (speedKilometersPerHour < 8 || diagnostics.mobileCruise.reversing) {
    return false;
  }

  const target = diagnostics.mobileCruise.targetSpeedKilometersPerHour;
  if (target >= 20) {
    return Math.abs(diagnostics.mobileCruiseVerticalIntent) <= 0.12;
  }

  // Deliberately exclude AUTO and the cruise controller's computed throttle:
  // onboarding observes what the player is doing, not what assistance outputs.
  return Math.abs(conventionalThrottleIntent(diagnostics)) <= 0.16;
}

export function brakeIntentIsActive(diagnostics: InputDiagnostics): boolean {
  if (diagnostics.mobileCruise.reversing) return false;
  return (
    conventionalThrottleIntent(diagnostics) < -0.16 ||
    diagnostics.mobileCruiseVerticalIntent < -0.18
  );
}

export interface BrakeObservation {
  peakForwardSpeedKilometersPerHour: number;
  speedKilometersPerHour: number;
  brakeIntentObserved: boolean;
  reversing: boolean;
}

export function brakeConditionIsMet(observation: BrakeObservation): boolean {
  if (observation.reversing || observation.speedKilometersPerHour < 0) {
    return false;
  }
  const realDeceleration =
    observation.peakForwardSpeedKilometersPerHour >= 12 &&
    observation.peakForwardSpeedKilometersPerHour -
      observation.speedKilometersPerHour >=
      5;
  const brakedToStop =
    observation.brakeIntentObserved &&
    observation.peakForwardSpeedKilometersPerHour >= 3 &&
    observation.speedKilometersPerHour < 3;
  return realDeceleration || brakedToStop;
}

export interface RouteFollowingObservation {
  routeVisible: boolean;
  speedKilometersPerHour: number;
  forwardSpeedMetersPerSecond: number;
  offRoute: boolean;
  requiresRejoin: boolean;
  surface: RoadSurface;
  roadNetworkReady: boolean;
  fallbackMode: boolean;
  distanceToRouteMeters: number | null;
  maximumDistanceToRouteMeters: number;
  reversing: boolean;
}

export function routeFollowingIsValid(
  observation: RouteFollowingObservation,
): boolean {
  const movementIsValid =
    observation.routeVisible &&
    observation.speedKilometersPerHour >= 5 &&
    observation.forwardSpeedMetersPerSecond > 0 &&
    !observation.reversing;
  if (observation.fallbackMode) {
    return movementIsValid && !observation.roadNetworkReady;
  }
  return (
    movementIsValid &&
    !observation.offRoute &&
    !observation.requiresRejoin &&
    observation.surface !== 'offroad' &&
    observation.roadNetworkReady &&
    observation.distanceToRouteMeters !== null &&
    observation.distanceToRouteMeters <=
      observation.maximumDistanceToRouteMeters
  );
}

export interface ObjectiveRecognitionObservation {
  distanceMeters: number | null;
  markerVisibleMilliseconds: number;
  isMissionTarget: boolean;
}

export function objectiveRecognitionIsMet(
  observation: ObjectiveRecognitionObservation,
): boolean {
  if (!observation.isMissionTarget) return false;
  return (
    (observation.distanceMeters !== null &&
      observation.distanceMeters <= 300) ||
    observation.markerVisibleMilliseconds >= 1_500
  );
}

export interface BoostSafetyContext {
  speedKilometersPerHour: number;
  fuel: number;
  condition: number;
  isPaused: boolean;
  hasBlockingOverlay: boolean;
  distanceToObjectiveMeters: number | null;
}

export function boostContextIsSafe(context: BoostSafetyContext): boolean {
  return (
    context.speedKilometersPerHour >= 12 &&
    context.fuel > 20 &&
    context.condition > 25 &&
    !context.isPaused &&
    !context.hasBlockingOverlay &&
    (context.distanceToObjectiveMeters === null ||
      context.distanceToObjectiveMeters > 120)
  );
}

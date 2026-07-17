import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { routingConfig } from '../../config/routing.config';
import type {
  InputController,
  InputDiagnostics,
} from '../../game/inputController';
import {
  brakeConditionIsMet,
  brakeIntentIsActive,
  coastConditionIsMet,
  conventionalThrottleIntent,
  onboardingStateForStep,
  onboardingStepIndexForState,
  routeFollowingIsValid,
  type OnboardingStepId,
} from '../../game/onboarding';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { MobileTutorialCard } from '../tutorial/MobileTutorialCard';

interface TutorialOverlayProps {
  input: InputController;
  onComplete: () => void;
  onSkip?: () => void;
}

interface TutorialStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  completed: boolean;
  available: boolean;
}

const STEP_ADVANCE_DELAY_MILLISECONDS = 420;
const COAST_HOLD_MILLISECONDS = 600;
const ROUTE_FOLLOW_HOLD_MILLISECONDS = 900;

function headingDifferenceDegrees(first: number, second: number): number {
  return Math.abs(((first - second + 540) % 360) - 180);
}

export function TutorialOverlay({
  input,
  onComplete,
  onSkip,
}: TutorialOverlayProps) {
  const onboardingState = useGameStore((state) => state.onboardingState);
  const [stepIndex, setStepIndex] = useState(
    () => onboardingStepIndexForState(onboardingState) ?? 0,
  );
  const [diagnostics, setDiagnostics] = useState<InputDiagnostics>(() =>
    input.getDiagnostics(),
  );
  const [coastCompleted, setCoastCompleted] = useState(false);
  const [brakeCompleted, setBrakeCompleted] = useState(false);
  const [routeFollowCompleted, setRouteFollowCompleted] = useState(false);
  const brakePeakSpeed = useRef(0);
  const brakeIntentObserved = useRef(false);
  const controlMode = useSettingsStore((state) => state.controlMode);
  const telemetry = useGameStore((state) => state.telemetry);
  const [steerStartHeading, setSteerStartHeading] = useState(telemetry.heading);
  const routeStatus = useGameStore((state) => state.missionRoute.status);
  const routeVisualReady = useGameStore(
    (state) => state.missionRoute.visualReady,
  );
  const routeOffRoute = useGameStore((state) => state.missionRoute.offRoute);
  const activeNavigation = useGameStore(
    (state) => state.missionRoute.activeNavigation,
  );
  const routeHeadingDifference = useGameStore(
    (state) => state.missionRoute.orientation.headingDifference,
  );
  const drivingSurface = useGameStore((state) => state.driving.surface);
  const roadNetworkStatus = useGameStore(
    (state) => state.driving.roadNetworkStatus,
  );
  const activeMissionId = useGameStore((state) => state.activeMissionId);
  const isPaused = useGameStore((state) => state.isPaused);
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);
  const recoveryReason = useGameStore((state) => state.recoveryReason);
  const activeNarrativeEventId = useGameStore(
    (state) => state.activeNarrativeEventId,
  );
  const activeMissionChoiceObjectiveId = useGameStore(
    (state) => state.activeMissionChoiceObjectiveId,
  );
  const setOnboardingState = useGameStore((state) => state.setOnboardingState);
  const [usesCompactCard] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(max-width: 700px)').matches),
  );

  useEffect(
    () => input.subscribe(() => setDiagnostics(input.getDiagnostics())),
    [input],
  );

  const hasBlockingOverlay = Boolean(
    recoveryReason ||
    activeNarrativeEventId ||
    activeMissionChoiceObjectiveId ||
    isJournalOpen,
  );
  const coastEligible =
    !hasBlockingOverlay &&
    !isPaused &&
    telemetry.speedMetersPerSecond > 0 &&
    coastConditionIsMet(diagnostics, telemetry.speedKilometersPerHour);
  const fallbackRoute = routeStatus === 'fallback';
  const routeVisible =
    routeVisualReady && (routeStatus === 'road' || fallbackRoute);
  const routeFollowingValid =
    !hasBlockingOverlay &&
    !isPaused &&
    routeFollowingIsValid({
      routeVisible,
      speedKilometersPerHour: telemetry.speedKilometersPerHour,
      forwardSpeedMetersPerSecond: telemetry.speedMetersPerSecond,
      offRoute: routeOffRoute,
      requiresRejoin: activeNavigation?.requiresRejoin ?? true,
      surface: drivingSurface,
      roadNetworkReady: roadNetworkStatus === 'ready',
      fallbackMode: fallbackRoute,
      distanceToRouteMeters: activeNavigation?.distanceToRouteMeters ?? null,
      maximumDistanceToRouteMeters: routingConfig.routeRejoinDistanceMeters,
      headingDifferenceDegrees: routeHeadingDifference,
      maximumHeadingDifferenceDegrees:
        routingConfig.tutorialRouteHeadingToleranceDegrees,
      reversing:
        diagnostics.mobileCruise.reversing ||
        telemetry.speedMetersPerSecond < -0.14,
    });

  useEffect(() => {
    if (stepIndex !== 2 || !coastEligible || coastCompleted) return;
    const timeout = window.setTimeout(
      () => setCoastCompleted(true),
      COAST_HOLD_MILLISECONDS,
    );
    return () => window.clearTimeout(timeout);
  }, [coastCompleted, coastEligible, stepIndex]);

  useEffect(() => {
    if (stepIndex !== 3) return;
    const speed = telemetry.speedKilometersPerHour;
    brakePeakSpeed.current = Math.max(brakePeakSpeed.current, speed);
    if (brakeIntentIsActive(diagnostics) && speed >= 3) {
      brakeIntentObserved.current = true;
    }
    if (
      brakeConditionIsMet({
        peakForwardSpeedKilometersPerHour: brakePeakSpeed.current,
        speedKilometersPerHour: speed,
        brakeIntentObserved: brakeIntentObserved.current,
        reversing:
          diagnostics.mobileCruise.reversing ||
          telemetry.speedMetersPerSecond < -0.14,
      })
    ) {
      setBrakeCompleted(true);
    }
  }, [
    diagnostics,
    stepIndex,
    telemetry.speedKilometersPerHour,
    telemetry.speedMetersPerSecond,
  ]);

  useEffect(() => {
    if (stepIndex !== 4 || !routeFollowingValid || activeMissionId === null)
      return;
    const timeout = window.setTimeout(
      () => setRouteFollowCompleted(true),
      ROUTE_FOLLOW_HOLD_MILLISECONDS,
    );
    return () => {
      window.clearTimeout(timeout);
      setRouteFollowCompleted(false);
    };
  }, [activeMissionId, routeFollowingValid, stepIndex]);

  const steps = useMemo<TutorialStep[]>(() => {
    const speedDescription = !usesCompactCard
      ? 'Mantén W para ganar velocidad.'
      : controlMode === 'classic-buttons'
        ? 'Mantén Avanzar para ganar velocidad.'
        : controlMode === 'target-speed-joystick' ||
            controlMode === 'arcade-driving'
          ? 'Empuja hacia arriba para elegir al menos 20 km/h.'
          : 'Acelera con el control derecho.';
    return [
      {
        id: 'select-speed',
        title: 'Elige tu velocidad',
        description: speedDescription,
        completed:
          conventionalThrottleIntent(diagnostics) > 0.45 ||
          diagnostics.mobileCruise.targetSpeedKilometersPerHour >= 20,
        available: true,
      },
      {
        id: 'steer',
        title: 'Gira en movimiento',
        description: 'Mantén la marcha y mueve la dirección hacia un lado.',
        completed:
          telemetry.speedKilometersPerHour >= 5 &&
          Math.abs(diagnostics.turn) > 0.4 &&
          headingDifferenceDegrees(telemetry.heading, steerStartHeading) >= 4,
        available: telemetry.speedKilometersPerHour >= 5,
      },
      {
        id: 'coast',
        title: 'Mantén la marcha',
        description: 'Centra el control durante un instante sin perder avance.',
        completed: coastCompleted,
        available: true,
      },
      {
        id: 'brake',
        title: 'Frena de verdad',
        description: !usesCompactCard
          ? 'Pulsa S para reducir al menos 5 km/h.'
          : 'Lleva el control abajo una vez para frenar, sin activar reversa.',
        completed: brakeCompleted,
        available: true,
      },
      {
        id: 'route',
        title: fallbackRoute ? 'Sigue la guía directa' : 'Sigue la línea cian',
        description: fallbackRoute
          ? 'No hay una ruta vial disponible; avanza con la guía directa para continuar.'
          : 'Conduce sobre el tramo brillante de la ruta.',
        completed: routeFollowCompleted && routeFollowingValid,
        available: routeVisible,
      },
    ];
  }, [
    brakeCompleted,
    coastCompleted,
    controlMode,
    diagnostics,
    fallbackRoute,
    routeFollowCompleted,
    routeFollowingValid,
    routeVisible,
    steerStartHeading,
    telemetry.heading,
    telemetry.speedKilometersPerHour,
    usesCompactCard,
  ]);
  const current = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    document.documentElement.dataset.tutorialTarget = current.id;
    return () => {
      if (document.documentElement.dataset.tutorialTarget === current.id) {
        delete document.documentElement.dataset.tutorialTarget;
      }
    };
  }, [current.id]);

  useEffect(() => {
    if (onboardingState === 'completed' || onboardingState === 'skipped') {
      return;
    }
    const nextState = onboardingStateForStep(current.id);
    if (onboardingState !== nextState) setOnboardingState(nextState);
  }, [current.id, onboardingState, setOnboardingState]);

  const complete = useCallback(() => {
    setOnboardingState('completed');
    onComplete();
  }, [onComplete, setOnboardingState]);

  const skip = useCallback(() => {
    setOnboardingState('skipped');
    (onSkip ?? onComplete)();
  }, [onComplete, onSkip, setOnboardingState]);

  useEffect(() => {
    if (!current.available || !current.completed) return;
    const timeout = window.setTimeout(() => {
      if (isLast) complete();
      else {
        if (current.id === 'select-speed') {
          setSteerStartHeading(useGameStore.getState().telemetry.heading);
        }
        setStepIndex((value) => Math.min(value + 1, steps.length - 1));
      }
    }, STEP_ADVANCE_DELAY_MILLISECONDS);
    return () => window.clearTimeout(timeout);
  }, [
    complete,
    current.available,
    current.completed,
    current.id,
    isLast,
    steps.length,
  ]);

  if (usesCompactCard) {
    return (
      <MobileTutorialCard
        step={stepIndex + 1}
        totalSteps={steps.length}
        title={current.title}
        description={current.description}
        available={current.available}
        onSkip={skip}
      />
    );
  }

  return (
    <aside
      className={`tutorial-coach tutorial-coach--contextual tutorial-coach--${current.id}`}
      aria-labelledby="tutorial-title"
      aria-live="polite"
      data-tutorial-step={current.id}
      data-tutorial-available={current.available}
    >
      <header>
        <span>
          {stepIndex + 1}/{steps.length}
        </span>
        <button type="button" onClick={skip}>
          Omitir
        </button>
      </header>
      <h2 id="tutorial-title">{current.title}</h2>
      <p>{current.description}</p>
      <small className="tutorial-coach__action-hint">
        {current.available
          ? 'Realiza la acción para continuar'
          : 'Continúa la misión para habilitar esta acción'}
      </small>
    </aside>
  );
}

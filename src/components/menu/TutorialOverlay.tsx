import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { missionById } from '../../data/missions';
import {
  interactionLabelForObjective,
  objectiveRequiresManualInteraction,
} from '../../game/interactions';
import type {
  InputController,
  InputDiagnostics,
} from '../../game/inputController';
import { nearestPendingObjective } from '../../game/missions';
import {
  boostContextIsSafe,
  brakeConditionIsMet,
  brakeIntentIsActive,
  coastConditionIsMet,
  conventionalThrottleIntent,
  objectiveRecognitionIsMet,
  onboardingStateForStep,
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
const OBJECTIVE_MARKER_HOLD_MILLISECONDS = 1_500;

export function TutorialOverlay({
  input,
  onComplete,
  onSkip,
}: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [diagnostics, setDiagnostics] = useState<InputDiagnostics>(() =>
    input.getDiagnostics(),
  );
  const [coastCompleted, setCoastCompleted] = useState(false);
  const [brakeCompleted, setBrakeCompleted] = useState(false);
  const [markerRecognized, setMarkerRecognized] = useState(false);
  const brakePeakSpeed = useRef(0);
  const brakeIntentObserved = useRef(false);
  const [initialStoryLogRevision] = useState(
    () => useGameStore.getState().storyLogRequest.revision,
  );
  const controlMode = useSettingsStore((state) => state.controlMode);
  const telemetry = useGameStore((state) => state.telemetry);
  const vehicleCondition = useGameStore((state) => state.vehicle.condition);
  const routeStatus = useGameStore((state) => state.missionRoute.status);
  const activeMissionId = useGameStore((state) => state.activeMissionId);
  const completedObjectiveIds = useGameStore(
    (state) => state.activeMissionCompletedObjectiveIds,
  );
  const navigationTarget = useGameStore((state) => state.navigationTarget);
  const isPaused = useGameStore((state) => state.isPaused);
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);
  const recoveryReason = useGameStore((state) => state.recoveryReason);
  const activeNarrativeEventId = useGameStore(
    (state) => state.activeNarrativeEventId,
  );
  const activeMissionChoiceObjectiveId = useGameStore(
    (state) => state.activeMissionChoiceObjectiveId,
  );
  const storyLogRevision = useGameStore(
    (state) => state.storyLogRequest.revision,
  );
  const onboardingState = useGameStore((state) => state.onboardingState);
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

  const activeMission = activeMissionId
    ? missionById.get(activeMissionId)
    : null;
  const nearestObjective = useMemo(
    () =>
      activeMission
        ? nearestPendingObjective(activeMission, completedObjectiveIds, [
            telemetry.longitude,
            telemetry.latitude,
          ])
        : null,
    [
      activeMission,
      completedObjectiveIds,
      telemetry.latitude,
      telemetry.longitude,
    ],
  );
  const routeVisible = routeStatus === 'road' || routeStatus === 'fallback';
  const interactionObjective = nearestObjective?.objective;
  const interactionLabel =
    interactionObjective &&
    objectiveRequiresManualInteraction(interactionObjective) &&
    nearestObjective.distanceMeters <= interactionObjective.radiusMeters
      ? interactionLabelForObjective(interactionObjective)
      : null;
  const hasBlockingOverlay = Boolean(
    recoveryReason ||
    activeNarrativeEventId ||
    activeMissionChoiceObjectiveId ||
    isJournalOpen,
  );
  const safeBoost =
    telemetry.speedMetersPerSecond > 0 &&
    boostContextIsSafe({
      speedKilometersPerHour: telemetry.speedKilometersPerHour,
      fuel: telemetry.fuel,
      condition: vehicleCondition,
      isPaused,
      hasBlockingOverlay,
      distanceToObjectiveMeters: nearestObjective?.distanceMeters ?? null,
    });
  const coastEligible =
    telemetry.speedMetersPerSecond > 0 &&
    coastConditionIsMet(diagnostics, telemetry.speedKilometersPerHour);
  const markerVisible = Boolean(routeVisible && nearestObjective);
  const isImmediateRouteTarget = Boolean(
    routeVisible && nearestObjective && navigationTarget === null,
  );

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
    if (stepIndex !== 5 || !markerVisible || markerRecognized) return;
    const timeout = window.setTimeout(
      () => setMarkerRecognized(true),
      OBJECTIVE_MARKER_HOLD_MILLISECONDS,
    );
    return () => window.clearTimeout(timeout);
  }, [markerRecognized, markerVisible, stepIndex]);

  const steps = useMemo<TutorialStep[]>(() => {
    const speedDescription = !usesCompactCard
      ? 'Mantén W para ganar velocidad.'
      : controlMode === 'classic-buttons'
        ? 'Mantén Avanzar para ganar velocidad.'
        : controlMode === 'target-speed-joystick'
          ? 'Empuja hacia arriba para elegir al menos 20 km/h.'
          : 'Acelera con el control derecho.';
    return [
      {
        id: 'steer',
        title: 'Gira el vehículo',
        description: 'Mueve la dirección hacia un lado.',
        completed: Math.abs(diagnostics.turn) > 0.4,
        available: true,
      },
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
        title: 'Sigue la línea cian',
        description: 'Conduce sobre el tramo brillante de la ruta.',
        completed: routeVisible && telemetry.speedKilometersPerHour >= 5,
        available: routeVisible,
      },
      {
        id: 'objective',
        title: 'Reconoce el objetivo',
        description: 'El círculo brillante marca tu próxima acción.',
        completed: objectiveRecognitionIsMet({
          distanceMeters: nearestObjective?.distanceMeters ?? null,
          markerVisibleMilliseconds: markerRecognized
            ? OBJECTIVE_MARKER_HOLD_MILLISECONDS
            : 0,
          isImmediateRouteTarget,
        }),
        available: Boolean(nearestObjective),
      },
      {
        id: 'interact',
        title: interactionLabel ?? 'Acércate para interactuar',
        description: interactionLabel
          ? !usesCompactCard
            ? `Pulsa E o Espacio para ${interactionLabel.toLocaleLowerCase()}.`
            : `Toca “${interactionLabel}”.`
          : 'La acción aparecerá cuando estés en el lugar correcto.',
        completed: Boolean(interactionLabel && diagnostics.interact),
        available: interactionLabel !== null,
      },
      {
        id: 'boost',
        title: 'Usa Turbo con espacio libre',
        description: safeBoost
          ? !usesCompactCard
            ? 'Mantén Shift durante la marcha.'
            : 'Toca Turbo ahora.'
          : 'Aléjate del objetivo y mantén una marcha estable.',
        completed: safeBoost && diagnostics.boost,
        available: safeBoost,
      },
      {
        id: 'journal',
        title: 'Abre la bitácora',
        description: 'Abre la bitácora para revisar la misión y las señales.',
        completed: isJournalOpen || storyLogRevision > initialStoryLogRevision,
        available: true,
      },
    ];
  }, [
    brakeCompleted,
    coastCompleted,
    controlMode,
    diagnostics,
    interactionLabel,
    initialStoryLogRevision,
    isImmediateRouteTarget,
    isJournalOpen,
    markerRecognized,
    nearestObjective,
    routeVisible,
    safeBoost,
    storyLogRevision,
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
      else setStepIndex((value) => Math.min(value + 1, steps.length - 1));
    }, STEP_ADVANCE_DELAY_MILLISECONDS);
    return () => window.clearTimeout(timeout);
  }, [complete, current.available, current.completed, isLast, steps.length]);

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

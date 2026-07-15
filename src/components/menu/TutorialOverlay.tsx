import { useEffect, useMemo, useState } from 'react';
import { MobileTutorialCard } from '../tutorial/MobileTutorialCard';
import type {
  InputController,
  InputDiagnostics,
} from '../../game/inputController';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';

interface TutorialOverlayProps {
  input: InputController;
  onComplete: () => void;
}

type TutorialTarget =
  | 'steer'
  | 'accelerate'
  | 'coast'
  | 'brake'
  | 'route'
  | 'target'
  | 'interact'
  | 'boost'
  | 'journal';

interface TutorialStep {
  id: TutorialTarget;
  title: string;
  description: string;
  completed: boolean;
  available: boolean;
  automatic: boolean;
}

export function TutorialOverlay({ input, onComplete }: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [diagnostics, setDiagnostics] = useState<InputDiagnostics>(() =>
    input.getDiagnostics(),
  );
  const [initialStoryLogRevision] = useState(
    () => useGameStore.getState().storyLogRequest.revision,
  );
  const controlMode = useSettingsStore((state) => state.controlMode);
  const telemetry = useGameStore((state) => state.telemetry);
  const routeStatus = useGameStore((state) => state.missionRoute.status);
  const storyLogRevision = useGameStore(
    (state) => state.storyLogRequest.revision,
  );
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

  const routeVisible = routeStatus === 'road' || routeStatus === 'fallback';
  const steps = useMemo<TutorialStep[]>(() => {
    const accelerationDescription = !usesCompactCard
      ? 'Mantén W para ganar velocidad.'
      : controlMode === 'classic-buttons'
        ? 'Mantén Avanzar para ganar velocidad.'
        : controlMode === 'target-speed-joystick'
          ? 'Empuja hacia arriba para elegir tu velocidad.'
          : 'Acelera con el control derecho.';
    return [
      {
        id: 'steer',
        title: 'Gira el vehículo',
        description: 'Mueve la dirección hacia un lado.',
        completed: Math.abs(diagnostics.turn) > 0.4,
        available: true,
        automatic: true,
      },
      {
        id: 'accelerate',
        title: 'Aumenta la velocidad',
        description: accelerationDescription,
        completed:
          diagnostics.throttle > 0.45 ||
          diagnostics.mobileCruise.targetSpeedKilometersPerHour >= 20,
        available: true,
        automatic: true,
      },
      {
        id: 'coast',
        title: 'Suelta y mantén la marcha',
        description: 'Centra el control mientras el vehículo sigue avanzando.',
        completed:
          Math.abs(telemetry.speedKilometersPerHour) >= 8 &&
          Math.abs(diagnostics.throttle) < 0.16,
        available: true,
        automatic: true,
      },
      {
        id: 'brake',
        title: 'Frena',
        description: !usesCompactCard
          ? 'Pulsa S para reducir la velocidad.'
          : 'Lleva el control hacia atrás para frenar.',
        completed: diagnostics.throttle < -0.35,
        available: true,
        automatic: true,
      },
      {
        id: 'route',
        title: 'Sigue la línea cian',
        description: 'Conduce sobre el tramo brillante de la ruta.',
        completed:
          routeVisible && Math.abs(telemetry.speedKilometersPerHour) >= 5,
        available: routeVisible,
        automatic: true,
      },
      {
        id: 'target',
        title: 'Identifica el objetivo',
        description: 'El círculo brillante marca tu próxima acción.',
        completed: false,
        available: routeVisible,
        automatic: false,
      },
      {
        id: 'interact',
        title: 'Interactúa',
        description: !usesCompactCard
          ? 'Pulsa Espacio o E cuando aparezca una acción cercana.'
          : 'Toca la acción contextual cuando aparezca.',
        completed: diagnostics.interact,
        available: true,
        automatic: true,
      },
      {
        id: 'boost',
        title: 'Usa Turbo',
        description: !usesCompactCard
          ? 'Mantén Shift mientras avanzas.'
          : 'Toca Turbo durante la marcha.',
        completed: diagnostics.boost,
        available: true,
        automatic: true,
      },
      {
        id: 'journal',
        title: 'Abre la bitácora',
        description: 'Toca la navegación cuando necesites revisar detalles.',
        completed: storyLogRevision > initialStoryLogRevision,
        available: true,
        automatic: true,
      },
    ];
  }, [
    controlMode,
    diagnostics,
    initialStoryLogRevision,
    routeVisible,
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
    if (!current.automatic || !current.completed) return;
    const timeout = window.setTimeout(() => {
      if (isLast) onComplete();
      else setStepIndex((value) => Math.min(value + 1, steps.length - 1));
    }, 420);
    return () => window.clearTimeout(timeout);
  }, [current.automatic, current.completed, isLast, onComplete, steps.length]);

  const previous = () => setStepIndex((value) => Math.max(0, value - 1));
  const next = () => {
    if (!current.available) return;
    if (isLast) onComplete();
    else setStepIndex((value) => Math.min(steps.length - 1, value + 1));
  };

  if (usesCompactCard) {
    return (
      <MobileTutorialCard
        step={stepIndex + 1}
        totalSteps={steps.length}
        title={current.title}
        description={current.description}
        canAdvance={current.available}
        automatic={current.automatic}
        isLast={isLast}
        onPrevious={previous}
        onNext={next}
        onSkip={onComplete}
      />
    );
  }

  return (
    <aside
      className={`tutorial-coach tutorial-coach--contextual tutorial-coach--${current.id}`}
      aria-labelledby="tutorial-title"
      aria-live="polite"
      data-tutorial-step={current.id}
    >
      <header>
        <span>
          {stepIndex + 1}/{steps.length}
        </span>
        <button type="button" onClick={onComplete}>
          Omitir
        </button>
      </header>
      <h2 id="tutorial-title">{current.title}</h2>
      <p>{current.description}</p>
      {current.automatic ? (
        <small className="tutorial-coach__action-hint">
          Realiza la acción para continuar
        </small>
      ) : (
        <div className="tutorial-coach__actions">
          <button type="button" disabled={stepIndex === 0} onClick={previous}>
            Anterior
          </button>
          <button
            type="button"
            className="tutorial-next"
            disabled={!current.available}
            onClick={next}
          >
            Entendido
          </button>
        </div>
      )}
    </aside>
  );
}

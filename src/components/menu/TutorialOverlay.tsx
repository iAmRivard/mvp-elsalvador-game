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
  | 'vehicle'
  | 'route'
  | 'target'
  | 'drive'
  | 'brake'
  | 'boost'
  | 'interact'
  | 'fuel'
  | 'rejoin';

interface TutorialStep {
  id: TutorialTarget;
  title: string;
  description: string;
  details?: string;
  completed: boolean;
  available: boolean;
  automatic: boolean;
}

interface VisibleTutorialTargets {
  vehicle: boolean;
  fuel: boolean;
}

function visibleTutorialTargets(): VisibleTutorialTargets {
  return {
    vehicle: Boolean(document.querySelector('.player-marker')),
    fuel: Boolean(document.querySelector('.fuel-station-marker')),
  };
}

export function TutorialOverlay({ input, onComplete }: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [diagnostics, setDiagnostics] = useState<InputDiagnostics>(() =>
    input.getDiagnostics(),
  );
  const [visibleTargets, setVisibleTargets] = useState(visibleTutorialTargets);
  const controlMode = useSettingsStore((state) => state.controlMode);
  const routeStatus = useGameStore((state) => state.missionRoute.status);
  const routeRequiresRejoin = useGameStore(
    (state) => state.missionRoute.activeNavigation?.requiresRejoin ?? false,
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

  useEffect(() => {
    const update = () => setVisibleTargets(visibleTutorialTargets());
    update();
    const interval = window.setInterval(update, 300);
    return () => window.clearInterval(interval);
  }, []);

  const routeVisible = routeStatus === 'road' || routeStatus === 'fallback';
  const steps = useMemo<TutorialStep[]>(() => {
    const driveDescription = !usesCompactCard
      ? 'Mantén W y usa A o D para acelerar y girar.'
      : controlMode === 'classic-buttons'
        ? 'Combina Avanzar con izquierda o derecha.'
        : controlMode === 'joystick-auto-throttle'
          ? 'Activa AUTO y mueve el joystick hacia un lado.'
          : 'Acelera y mueve el joystick hacia un lado.';
    return [
      {
        id: 'vehicle',
        title: 'Tu vehículo',
        description:
          'El marcador iluminado representa tu vehículo. La parte delantera indica hacia dónde mira.',
        completed: false,
        available: visibleTargets.vehicle,
        automatic: false,
      },
      {
        id: 'route',
        title: 'Tu ruta',
        description: 'La línea cian marca el camino recomendado.',
        details:
          'El tramo blanco y celeste es la parte inmediata que debes seguir.',
        completed: false,
        available: routeVisible,
        automatic: false,
      },
      {
        id: 'target',
        title: 'Tu objetivo',
        description: 'El círculo brillante indica tu siguiente objetivo.',
        completed: false,
        available: routeVisible,
        automatic: false,
      },
      {
        id: 'drive',
        title: 'Conduce',
        description: driveDescription,
        completed:
          Math.abs(diagnostics.turn) >= 0.2 && diagnostics.throttle >= 0.3,
        available: true,
        automatic: true,
      },
      {
        id: 'brake',
        title: 'Frena y retrocede',
        description: !usesCompactCard
          ? 'Pulsa S para frenar; al detenerte podrás retroceder.'
          : 'Lleva el control hacia atrás para frenar y luego retroceder.',
        completed: diagnostics.throttle <= -0.3,
        available: true,
        automatic: true,
      },
      {
        id: 'boost',
        title: 'Usa el turbo',
        description: !usesCompactCard
          ? 'Mantén Shift mientras aceleras.'
          : 'Toca Turbo durante el avance.',
        completed: diagnostics.boost,
        available: true,
        automatic: true,
      },
      {
        id: 'interact',
        title: 'Interactúa',
        description: !usesCompactCard
          ? 'Pulsa Espacio cuando estés dentro de un objetivo.'
          : 'Usa la acción contextual cuando aparezca.',
        completed: diagnostics.interact,
        available: true,
        automatic: true,
      },
      {
        id: 'fuel',
        title: 'Puntos de combustible',
        description: 'Puedes recargar en los puntos marcados con una bomba.',
        details:
          'Con combustible bajo, el HUD puede marcar la estación disponible más cercana.',
        completed: false,
        available: visibleTargets.fuel,
        automatic: false,
      },
      {
        id: 'rejoin',
        title: 'Vuelve a la ruta',
        description:
          'La línea celeste discontinua aparece cuando necesitas reincorporarte.',
        details:
          'Si la ruta deja de coincidir, usa el botón de recálculo de la bitácora.',
        completed: routeRequiresRejoin,
        available: routeVisible,
        automatic: false,
      },
    ];
  }, [
    controlMode,
    diagnostics,
    routeRequiresRejoin,
    routeVisible,
    usesCompactCard,
    visibleTargets,
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
    }, 500);
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
        details={current.details}
        canAdvance={current.available}
        isLast={isLast}
        onPrevious={previous}
        onNext={next}
        onSkip={onComplete}
      />
    );
  }

  return (
    <aside
      className={`tutorial-coach tutorial-coach--${current.id}`}
      aria-labelledby="tutorial-title"
      aria-live="polite"
      data-tutorial-step={current.id}
    >
      <header>
        <span>
          Paso {stepIndex + 1} de {steps.length}
        </span>
        <button type="button" onClick={onComplete}>
          Omitir
        </button>
      </header>
      <h2 id="tutorial-title">{current.title}</h2>
      <p>{current.description}</p>
      <div
        className="tutorial-progress"
        aria-label={`Paso ${stepIndex + 1} de ${steps.length}`}
      >
        {steps.map((step, index) => (
          <span
            key={step.id}
            className={index <= stepIndex ? 'is-active' : ''}
          />
        ))}
      </div>
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
          {isLast ? 'Finalizar' : 'Siguiente'}
        </button>
      </div>
    </aside>
  );
}

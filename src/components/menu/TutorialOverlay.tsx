import { useEffect, useMemo, useState } from 'react';
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
  | 'throttle'
  | 'route'
  | 'brake'
  | 'boost'
  | 'interact'
  | 'collect'
  | 'repair'
  | 'recalculate';

interface TutorialStep {
  id: TutorialTarget;
  title: string;
  description: string;
  completed: boolean;
}

export function TutorialOverlay({ input, onComplete }: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [diagnostics, setDiagnostics] = useState<InputDiagnostics>(() =>
    input.getDiagnostics(),
  );
  const controlMode = useSettingsStore((state) => state.controlMode);
  const routeStatus = useGameStore((state) => state.missionRoute.status);
  const routeRevision = useGameStore(
    (state) => state.missionRoute.recalculationRevision,
  );
  const inventory = useGameStore((state) => state.inventory);
  const vehicleCondition = useGameStore((state) => state.vehicle.condition);
  const completedObjectiveIds = useGameStore(
    (state) => state.activeMissionCompletedObjectiveIds,
  );
  const [usesTouch] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches,
  );
  const [initialRouteRevision] = useState(routeRevision);
  const [initialCondition] = useState(vehicleCondition);

  useEffect(
    () => input.subscribe(() => setDiagnostics(input.getDiagnostics())),
    [input],
  );

  const steps = useMemo<TutorialStep[]>(() => {
    const steeringDescription = !usesTouch
      ? 'Pulsa A o D para orientar el vehículo.'
      : controlMode === 'classic-buttons'
        ? 'Usa izquierda o derecha en la cruceta.'
        : 'Mueve el joystick hacia un lado.';
    const throttleDescription = !usesTouch
      ? 'Mantén W para comenzar a avanzar.'
      : controlMode === 'joystick-auto-throttle'
        ? 'Activa AUTO para mantener el avance.'
        : controlMode === 'classic-buttons'
          ? 'Mantén Avanzar en la cruceta.'
          : 'Mantén presionado el acelerador.';
    return [
      {
        id: 'steer',
        title: 'Prueba la dirección',
        description: steeringDescription,
        completed: Math.abs(diagnostics.turn) >= 0.2,
      },
      {
        id: 'throttle',
        title: 'Inicia el recorrido',
        description: throttleDescription,
        completed:
          controlMode === 'joystick-auto-throttle'
            ? diagnostics.autoThrottleStatus === 'active'
            : diagnostics.throttle >= 0.3,
      },
      {
        id: 'route',
        title: 'Sigue la ruta',
        description:
          'Inicia una misión y mantén el vehículo sobre el tramo resaltado.',
        completed: routeStatus === 'road' || routeStatus === 'fallback',
      },
      {
        id: 'brake',
        title: 'Encuentra el freno',
        description: !usesTouch
          ? 'Pulsa S para frenar o retroceder.'
          : 'Mantén Freno para reducir velocidad o dar reversa.',
        completed: diagnostics.throttle <= -0.3,
      },
      {
        id: 'boost',
        title: 'Usa el turbo',
        description: !usesTouch
          ? 'Mantén Shift mientras aceleras.'
          : 'Toca Turbo para activar un impulso temporal.',
        completed: diagnostics.boost,
      },
      {
        id: 'interact',
        title: 'Investiga una señal',
        description: !usesTouch
          ? 'Pulsa Espacio cuando estés dentro de un objetivo.'
          : 'Usa la acción contextual cuando aparezca.',
        completed: diagnostics.interact,
      },
      {
        id: 'collect',
        title: 'Recoge combustible',
        description:
          'En la estación, usa Recoger cuando aparezca junto al bidón.',
        completed: inventory.some(
          (entry) => entry.itemId === 'bidon-combustible' && entry.quantity > 0,
        ),
      },
      {
        id: 'repair',
        title: 'Repara el vehículo',
        description:
          'Cuando tengas el repuesto, usa Reparar dentro del objetivo.',
        completed:
          vehicleCondition > initialCondition ||
          completedObjectiveIds.includes('reparar-vehiculo'),
      },
      {
        id: 'recalculate',
        title: 'Recalcula la ruta',
        description:
          'Usa el botón de recálculo si abandonas el camino marcado.',
        completed: routeRevision > initialRouteRevision,
      },
    ];
  }, [
    completedObjectiveIds,
    controlMode,
    diagnostics,
    inventory,
    initialCondition,
    initialRouteRevision,
    routeRevision,
    routeStatus,
    usesTouch,
    vehicleCondition,
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
    if (!current.completed) return;
    const timeout = window.setTimeout(() => {
      if (isLast) onComplete();
      else setStepIndex((value) => Math.min(value + 1, steps.length - 1));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [current.completed, isLast, onComplete, steps.length]);

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
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
        >
          Anterior
        </button>
        <button
          type="button"
          className="tutorial-next"
          onClick={() =>
            isLast
              ? onComplete()
              : setStepIndex((value) => Math.min(steps.length - 1, value + 1))
          }
        >
          {isLast ? 'Finalizar' : 'Siguiente'}
        </button>
      </div>
    </aside>
  );
}

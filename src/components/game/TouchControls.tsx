import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { InputAction, InputController } from '../../game/inputController';
import { useGameStore } from '../../store/gameStore';
import { missionById } from '../../data/missions';
import { objectiveIsAvailable } from '../../game/missions';

interface TouchControlsProps {
  input: InputController;
}

const interactionLabels = {
  interact: 'Investigar',
  collect: 'Recoger',
  deliver: 'Entregar',
  repair: 'Reparar',
  refuel: 'Cargar',
  choice: 'Elegir',
} as const;

export function TouchControls({ input }: TouchControlsProps) {
  const isPaused = useGameStore((state) => state.isPaused);
  const togglePaused = useGameStore((state) => state.togglePaused);
  const setFollowingPlayer = useGameStore((state) => state.setFollowingPlayer);
  const activeMissionId = useGameStore((state) => state.activeMissionId);
  const completedObjectiveIds = useGameStore(
    (state) => state.activeMissionCompletedObjectiveIds,
  );
  const activeMission = activeMissionId
    ? missionById.get(activeMissionId)
    : null;
  const interactionObjective = activeMission?.objectives.find(
    (objective) =>
      objective.type in interactionLabels &&
      !completedObjectiveIds.includes(objective.id) &&
      objectiveIsAvailable(objective, completedObjectiveIds),
  );
  const interactionLabel = interactionObjective
    ? interactionLabels[
        interactionObjective.type as keyof typeof interactionLabels
      ]
    : null;

  const press = (action: InputAction) => {
    const releaseDelayMilliseconds = action === 'interact' ? 250 : 0;
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        input.setPointerAction(action, true);
      },
      onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        input.releasePointerAction(action, releaseDelayMilliseconds);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      },
      onPointerCancel: () => input.setPointerAction(action, false),
      onLostPointerCapture: () =>
        input.releasePointerAction(action, releaseDelayMilliseconds),
      onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) =>
        event.preventDefault(),
    };
  };

  return (
    <div
      className="touch-controls"
      aria-label="Controles táctiles"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="touch-dpad" aria-label="Dirección">
        <button
          type="button"
          className="touch-button touch-button--up"
          aria-label="Avanzar"
          {...press('forward')}
        >
          <span aria-hidden="true">▲</span>
        </button>
        <button
          type="button"
          className="touch-button touch-button--left"
          aria-label="Girar a la izquierda"
          {...press('left')}
        >
          <span aria-hidden="true">◀</span>
        </button>
        <button
          type="button"
          className="touch-button touch-button--right"
          aria-label="Girar a la derecha"
          {...press('right')}
        >
          <span aria-hidden="true">▶</span>
        </button>
        <button
          type="button"
          className="touch-button touch-button--down"
          aria-label="Retroceder"
          {...press('backward')}
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>

      <div className="touch-actions">
        <div className="touch-utilities">
          <button
            type="button"
            className="touch-button touch-button--utility"
            aria-label="Centrar cámara en el jugador"
            onClick={() => setFollowingPlayer(true)}
          >
            <span aria-hidden="true">⌖</span>
          </button>
          <button
            type="button"
            className={`touch-button touch-button--utility ${isPaused ? 'touch-button--active' : ''}`}
            aria-label={isPaused ? 'Reanudar partida' : 'Pausar partida'}
            onClick={togglePaused}
          >
            <span aria-hidden="true">{isPaused ? '▶' : 'Ⅱ'}</span>
          </button>
        </div>

        <div className="touch-primary-actions">
          {interactionLabel && (
            <button
              type="button"
              className="touch-button touch-button--interact"
              aria-label={interactionLabel}
              {...press('interact')}
            >
              <span aria-hidden="true">✦</span>
              <small>{interactionLabel}</small>
            </button>
          )}
          <button
            type="button"
            className="touch-button touch-button--boost"
            aria-label="Acelerar"
            {...press('boost')}
          >
            <span aria-hidden="true">+</span>
            <small>Turbo</small>
          </button>
        </div>
      </div>
    </div>
  );
}

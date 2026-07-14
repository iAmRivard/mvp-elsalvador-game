import type { InputController } from '../../game/inputController';
import { MobileActionButtons } from './MobileActionButtons';
import { pointerActionHandlers } from './pointerControlHandlers';

interface ClassicTouchControlsProps {
  input: InputController;
  interactionLabel: string | null;
  isPaused: boolean;
  onCenter: () => void;
  onTogglePause: () => void;
}

export function ClassicTouchControls({
  input,
  interactionLabel,
  isPaused,
  onCenter,
  onTogglePause,
}: ClassicTouchControlsProps) {
  return (
    <>
      <div className="touch-dpad" aria-label="Dirección clásica">
        <button
          type="button"
          className="touch-button touch-button--up"
          aria-label="Avanzar"
          {...pointerActionHandlers(input, 'forward')}
        >
          <span aria-hidden="true">▲</span>
        </button>
        <button
          type="button"
          className="touch-button touch-button--left"
          aria-label="Girar a la izquierda"
          {...pointerActionHandlers(input, 'left')}
        >
          <span aria-hidden="true">◀</span>
        </button>
        <button
          type="button"
          className="touch-button touch-button--right"
          aria-label="Girar a la derecha"
          {...pointerActionHandlers(input, 'right')}
        >
          <span aria-hidden="true">▶</span>
        </button>
        <button
          type="button"
          className="touch-button touch-button--down"
          aria-label="Retroceder"
          {...pointerActionHandlers(input, 'backward')}
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>
      <div className="touch-actions">
        <MobileActionButtons
          input={input}
          interactionLabel={interactionLabel}
          isPaused={isPaused}
          onCenter={onCenter}
          onTogglePause={onTogglePause}
        />
      </div>
    </>
  );
}

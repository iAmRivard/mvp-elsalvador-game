import type { InputController } from '../../game/inputController';
import { triggerHaptic } from '../../game/haptics';
import { MobileActionButtons } from './MobileActionButtons';
import { pointerActionHandlers } from './pointerControlHandlers';

interface ClassicTouchControlsProps {
  input: InputController;
  interactionLabel: string | null;
  isPaused: boolean;
  onCenter: () => void;
  onTogglePause: () => void;
  hapticsEnabled: boolean;
}

export function ClassicTouchControls({
  input,
  interactionLabel,
  isPaused,
  onCenter,
  onTogglePause,
  hapticsEnabled,
}: ClassicTouchControlsProps) {
  return (
    <>
      <div className="touch-dpad" aria-label="Dirección clásica">
        <button
          type="button"
          className="touch-button touch-button--up"
          aria-label="Avanzar"
          {...pointerActionHandlers(input, 'forward', 0, () =>
            triggerHaptic('button', hapticsEnabled),
          )}
        >
          <span aria-hidden="true">▲</span>
        </button>
        <button
          type="button"
          className="touch-button touch-button--left"
          aria-label="Girar a la izquierda"
          {...pointerActionHandlers(input, 'left', 0, () =>
            triggerHaptic('button', hapticsEnabled),
          )}
        >
          <span aria-hidden="true">◀</span>
        </button>
        <button
          type="button"
          className="touch-button touch-button--right"
          aria-label="Girar a la derecha"
          {...pointerActionHandlers(input, 'right', 0, () =>
            triggerHaptic('button', hapticsEnabled),
          )}
        >
          <span aria-hidden="true">▶</span>
        </button>
        <button
          type="button"
          className="touch-button touch-button--down"
          aria-label="Retroceder"
          {...pointerActionHandlers(input, 'backward', 0, () =>
            triggerHaptic('button', hapticsEnabled),
          )}
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
          hapticsEnabled={hapticsEnabled}
        />
      </div>
    </>
  );
}

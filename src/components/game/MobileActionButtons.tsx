import type { InputController } from '../../game/inputController';
import { pointerActionHandlers } from './pointerControlHandlers';

interface MobileActionButtonsProps {
  input: InputController;
  interactionLabel: string | null;
  isPaused: boolean;
  onCenter: () => void;
  onTogglePause: () => void;
}

export function MobileActionButtons({
  input,
  interactionLabel,
  isPaused,
  onCenter,
  onTogglePause,
}: MobileActionButtonsProps) {
  return (
    <div className="mobile-actions">
      <div className="touch-utilities">
        <button
          type="button"
          className="touch-button touch-button--utility"
          aria-label="Centrar cámara en el jugador"
          onClick={onCenter}
        >
          <span aria-hidden="true">⌖</span>
        </button>
        <button
          type="button"
          className={`touch-button touch-button--utility ${isPaused ? 'touch-button--active' : ''}`}
          aria-label={isPaused ? 'Reanudar partida' : 'Pausar partida'}
          onClick={onTogglePause}
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
            {...pointerActionHandlers(input, 'interact', 250)}
          >
            <span aria-hidden="true">✦</span>
            <small>{interactionLabel}</small>
          </button>
        )}
        <button
          type="button"
          className="touch-button touch-button--boost"
          aria-label="Turbo"
          {...pointerActionHandlers(input, 'boost')}
        >
          <span aria-hidden="true">＋</span>
          <small>Turbo</small>
        </button>
      </div>
    </div>
  );
}

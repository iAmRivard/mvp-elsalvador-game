import { useSyncExternalStore } from 'react';
import { autoThrottleConfig } from '../../config/mobileControls.config';
import { triggerHaptic } from '../../game/haptics';
import type { InputController } from '../../game/inputController';
import { pointerActionHandlers } from './pointerControlHandlers';

interface MobileActionButtonsProps {
  input: InputController;
  interactionLabel: string | null;
  isPaused: boolean;
  onCenter: () => void;
  onTogglePause: () => void;
  autoThrottleAvailable?: boolean;
  hapticsEnabled: boolean;
}

export function MobileActionButtons({
  input,
  interactionLabel,
  isPaused,
  onCenter,
  onTogglePause,
  autoThrottleAvailable = false,
  hapticsEnabled,
}: MobileActionButtonsProps) {
  const autoThrottleStatus = useSyncExternalStore(
    (listener) => input.subscribe(listener),
    () => input.getAutoThrottleStatus(),
    () => 'off',
  );

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
            {...pointerActionHandlers(input, 'interact', 250, () =>
              triggerHaptic('button', hapticsEnabled),
            )}
          >
            <span aria-hidden="true">✦</span>
            <small>{interactionLabel}</small>
          </button>
        )}
        <button
          type="button"
          className="touch-button touch-button--boost"
          aria-label="Turbo"
          {...pointerActionHandlers(input, 'boost', 0, () =>
            triggerHaptic('boost', hapticsEnabled),
          )}
        >
          <span aria-hidden="true">＋</span>
          <small>Turbo</small>
        </button>
        {autoThrottleAvailable && (
          <button
            type="button"
            className={`touch-button touch-button--auto touch-button--auto-${autoThrottleStatus}`}
            aria-label={
              autoThrottleStatus === 'active'
                ? 'Desactivar crucero'
                : 'Activar crucero'
            }
            aria-pressed={autoThrottleStatus !== 'off'}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              input.toggleAutoThrottle(autoThrottleConfig.targetThrottle);
              triggerHaptic('auto-throttle', hapticsEnabled);
            }}
          >
            <strong>AUTO</strong>
            <small>
              {autoThrottleStatus === 'active'
                ? 'Activo'
                : autoThrottleStatus === 'suspended'
                  ? 'En espera'
                  : 'Apagado'}
            </small>
          </button>
        )}
      </div>
    </div>
  );
}

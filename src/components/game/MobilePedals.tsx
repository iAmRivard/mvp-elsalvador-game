import type { InputController } from '../../game/inputController';
import { triggerHaptic } from '../../game/haptics';
import { pointerActionHandlers } from './pointerControlHandlers';

interface MobilePedalsProps {
  input: InputController;
  showAccelerator: boolean;
  hapticsEnabled: boolean;
  controlsDisabled: boolean;
}

export function MobilePedals({
  input,
  showAccelerator,
  hapticsEnabled,
  controlsDisabled,
}: MobilePedalsProps) {
  return (
    <div className="mobile-pedals" aria-label="Pedales">
      {showAccelerator && (
        <button
          type="button"
          className="touch-button mobile-pedal mobile-pedal--accelerator"
          aria-label="Acelerar"
          disabled={controlsDisabled}
          {...pointerActionHandlers(
            input,
            'forward',
            0,
            controlsDisabled,
            () => triggerHaptic('button', hapticsEnabled),
          )}
        >
          <span aria-hidden="true">＋</span>
          <small>Acelerar</small>
        </button>
      )}
      <button
        type="button"
        className="touch-button mobile-pedal mobile-pedal--brake"
        aria-label="Frenar o retroceder"
        disabled={controlsDisabled}
        {...pointerActionHandlers(
          input,
          'backward',
          0,
          controlsDisabled,
          () => triggerHaptic('button', hapticsEnabled),
        )}
      >
        <span aria-hidden="true">−</span>
        <small>Freno</small>
      </button>
    </div>
  );
}

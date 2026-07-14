import type { InputController } from '../../game/inputController';
import { pointerActionHandlers } from './pointerControlHandlers';

interface MobilePedalsProps {
  input: InputController;
  showAccelerator: boolean;
}

export function MobilePedals({ input, showAccelerator }: MobilePedalsProps) {
  return (
    <div className="mobile-pedals" aria-label="Pedales">
      {showAccelerator && (
        <button
          type="button"
          className="touch-button mobile-pedal mobile-pedal--accelerator"
          aria-label="Acelerar"
          {...pointerActionHandlers(input, 'forward')}
        >
          <span aria-hidden="true">＋</span>
          <small>Acelerar</small>
        </button>
      )}
      <button
        type="button"
        className="touch-button mobile-pedal mobile-pedal--brake"
        aria-label="Frenar o retroceder"
        {...pointerActionHandlers(input, 'backward')}
      >
        <span aria-hidden="true">−</span>
        <small>Freno</small>
      </button>
    </div>
  );
}

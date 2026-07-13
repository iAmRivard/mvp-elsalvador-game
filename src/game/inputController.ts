import type { PlayerInput } from '../types/game';

export type InputAction =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'boost'
  | 'interact';

const keyActions: Readonly<Record<string, InputAction>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  Space: 'interact',
};

export class InputController {
  private readonly keyboardActions = new Set<InputAction>();
  private readonly pointerActions = new Set<InputAction>();

  bindKeyboard(target: Window, onTogglePause: () => void): () => void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        if (!event.repeat) onTogglePause();
        event.preventDefault();
        return;
      }

      const action = keyActions[event.code];
      if (!action || event.metaKey || event.ctrlKey || event.altKey) return;
      this.keyboardActions.add(action);
      event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = keyActions[event.code];
      if (!action) return;
      this.keyboardActions.delete(action);
      event.preventDefault();
    };

    const clearKeyboard = () => this.keyboardActions.clear();
    target.addEventListener('keydown', handleKeyDown, { passive: false });
    target.addEventListener('keyup', handleKeyUp, { passive: false });
    target.addEventListener('blur', clearKeyboard);

    return () => {
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('keyup', handleKeyUp);
      target.removeEventListener('blur', clearKeyboard);
      clearKeyboard();
    };
  }

  setPointerAction(action: InputAction, active: boolean): void {
    if (active) this.pointerActions.add(action);
    else this.pointerActions.delete(action);
  }

  clearPointerActions(): void {
    this.pointerActions.clear();
  }

  snapshot(): PlayerInput {
    const active = (action: InputAction) =>
      this.keyboardActions.has(action) || this.pointerActions.has(action);
    const throttle = Number(active('forward')) - Number(active('backward'));
    const turn = Number(active('right')) - Number(active('left'));

    return {
      throttle: Math.sign(throttle) as PlayerInput['throttle'],
      turn: Math.sign(turn) as PlayerInput['turn'],
      boost: active('boost'),
      interact: active('interact'),
    };
  }
}

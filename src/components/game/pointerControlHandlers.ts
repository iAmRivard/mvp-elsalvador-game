import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { InputAction, InputController } from '../../game/inputController';

export function pointerActionHandlers(
  input: InputController,
  action: InputAction,
  releaseDelayMilliseconds = 0,
) {
  const release = (
    event: ReactPointerEvent<HTMLButtonElement>,
    releaseCapture: boolean,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    input.releasePointerAction(action, releaseDelayMilliseconds);
    input.setPointerActive(event.pointerId, false);
    if (
      releaseCapture &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      input.setPointerActive(event.pointerId, true);
      input.setPointerAction(action, true);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) =>
      release(event, true),
    onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) =>
      release(event, false),
    onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) =>
      release(event, false),
    onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) =>
      event.preventDefault(),
  };
}

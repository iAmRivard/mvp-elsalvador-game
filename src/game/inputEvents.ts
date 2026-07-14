export const CLEAR_GAME_INPUT_EVENT = 'el-salvador-game:clear-input';
export const RESET_GAME_INPUT_EVENT = 'el-salvador-game:reset-input';

export function requestInputClear(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CLEAR_GAME_INPUT_EVENT));
  }
}

export function requestInputReset(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(RESET_GAME_INPUT_EVENT));
  }
}

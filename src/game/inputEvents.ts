export const CLEAR_GAME_INPUT_EVENT = 'el-salvador-game:clear-input';

export function requestInputClear(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CLEAR_GAME_INPUT_EVENT));
  }
}

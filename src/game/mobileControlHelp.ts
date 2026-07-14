export const AUTO_THROTTLE_HINT_KEY =
  'el-salvador-rutas-perdidas:auto-throttle-hint-seen';

interface HintStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function consumeAutoThrottleHint(
  storage: HintStorage | null = typeof window === 'undefined'
    ? null
    : window.localStorage,
): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(AUTO_THROTTLE_HINT_KEY) === 'true') return false;
    storage.setItem(AUTO_THROTTLE_HINT_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

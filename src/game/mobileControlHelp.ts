export const AUTO_THROTTLE_HINT_KEY =
  'el-salvador-rutas-perdidas:auto-throttle-hint-seen';
export const MOBILE_ACTION_LABELS_KEY =
  'el-salvador-rutas-perdidas:mobile-action-labels-seen';

interface HintStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function consumeMobileActionLabels(
  storage: HintStorage | null = typeof window === 'undefined'
    ? null
    : window.sessionStorage,
): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(MOBILE_ACTION_LABELS_KEY) === 'true') return false;
    storage.setItem(MOBILE_ACTION_LABELS_KEY, 'true');
    return true;
  } catch {
    return false;
  }
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

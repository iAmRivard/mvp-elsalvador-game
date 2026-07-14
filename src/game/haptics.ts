export type HapticEvent =
  | 'button'
  | 'boost'
  | 'offroad'
  | 'collision'
  | 'objective'
  | 'auto-throttle'
  | 'condition-warning'
  | 'timer-warning';

const hapticPatterns: Readonly<Record<HapticEvent, number | number[]>> = {
  button: 12,
  boost: [18, 28, 18],
  offroad: 18,
  collision: [35, 25, 35],
  objective: [16, 35, 28],
  'auto-throttle': [12, 24, 12],
  'condition-warning': [28, 45, 28],
  'timer-warning': [18, 24, 18],
};

export function triggerHaptic(event: HapticEvent, enabled: boolean): void {
  if (!enabled || typeof navigator === 'undefined') return;
  try {
    navigator.vibrate?.(hapticPatterns[event]);
  } catch {
    // La vibración es una mejora opcional y algunos navegadores la bloquean.
  }
}

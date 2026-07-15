export const onboardingStates = [
  'not-started',
  'introducing',
  'driving-basics',
  'navigation-basics',
  'interaction-basics',
  'completed',
  'skipped',
] as const;

export type OnboardingState = (typeof onboardingStates)[number];

export function isOnboardingState(value: unknown): value is OnboardingState {
  return onboardingStates.includes(value as OnboardingState);
}

export function onboardingIsActive(state: OnboardingState): boolean {
  return state !== 'not-started' && state !== 'completed' && state !== 'skipped';
}

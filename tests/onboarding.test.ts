import { describe, expect, it } from 'vitest';
import type { InputDiagnostics } from '../src/game/inputController';
import {
  boostContextIsSafe,
  brakeConditionIsMet,
  brakeIntentIsActive,
  coastConditionIsMet,
  objectiveRecognitionIsMet,
  onboardingStateForStep,
} from '../src/game/onboarding';

function diagnostics(values: Partial<InputDiagnostics> = {}): InputDiagnostics {
  return {
    keyboardThrottle: 0,
    keyboardTurn: 0,
    pointerThrottle: 0,
    pointerTurn: 0,
    touchThrottle: 0,
    joystickThrottle: 0,
    joystickTurn: 0,
    autoThrottle: 0,
    mobileCruiseThrottle: 0,
    mobileCruiseVerticalIntent: 0,
    throttle: 0,
    turn: 0,
    boost: false,
    interact: false,
    autoThrottleStatus: 'off',
    pointerActive: false,
    mobileBoost: {
      active: false,
      remainingMilliseconds: 0,
      cooldownRemainingMilliseconds: 0,
    },
    mobileCruise: {
      targetSpeedKilometersPerHour: 0,
      selectedGear: 'stopped',
      braking: false,
      reversing: false,
      reverseState: 'forward',
    },
    ...values,
  };
}

describe('reglas de onboarding', () => {
  it('mapea los nueve pasos a estados persistibles', () => {
    expect(onboardingStateForStep('steer')).toBe('introducing');
    expect(onboardingStateForStep('select-speed')).toBe('driving-basics');
    expect(onboardingStateForStep('coast')).toBe('driving-basics');
    expect(onboardingStateForStep('brake')).toBe('driving-basics');
    expect(onboardingStateForStep('route')).toBe('navigation-basics');
    expect(onboardingStateForStep('objective')).toBe('navigation-basics');
    expect(onboardingStateForStep('interact')).toBe('interaction-basics');
    expect(onboardingStateForStep('boost')).toBe('interaction-basics');
    expect(onboardingStateForStep('journal')).toBe('interaction-basics');
  });

  it('detecta coast por intención cruda y no por AUTO calculado', () => {
    expect(
      coastConditionIsMet(
        diagnostics({ autoThrottle: 0.72, throttle: 0.72 }),
        12,
      ),
    ).toBe(true);
    expect(
      coastConditionIsMet(
        diagnostics({
          mobileCruiseVerticalIntent: 0.13,
          mobileCruise: {
            targetSpeedKilometersPerHour: 30,
            selectedGear: 'slow',
            braking: false,
            reversing: false,
            reverseState: 'forward',
          },
        }),
        12,
      ),
    ).toBe(false);
    expect(coastConditionIsMet(diagnostics(), 7.99)).toBe(false);
  });

  it('acepta desaceleración real o frenado hasta detenerse, nunca reversa', () => {
    expect(
      brakeConditionIsMet({
        peakForwardSpeedKilometersPerHour: 20,
        speedKilometersPerHour: 15,
        brakeIntentObserved: false,
        reversing: false,
      }),
    ).toBe(true);
    expect(
      brakeConditionIsMet({
        peakForwardSpeedKilometersPerHour: 8,
        speedKilometersPerHour: 2.9,
        brakeIntentObserved: true,
        reversing: false,
      }),
    ).toBe(true);
    expect(
      brakeConditionIsMet({
        peakForwardSpeedKilometersPerHour: 20,
        speedKilometersPerHour: 0,
        brakeIntentObserved: true,
        reversing: true,
      }),
    ).toBe(false);
    expect(
      brakeIntentIsActive(
        diagnostics({
          mobileCruiseVerticalIntent: -1,
          mobileCruise: {
            targetSpeedKilometersPerHour: 0,
            selectedGear: 'stopped',
            braking: false,
            reversing: true,
            reverseState: 'reversing',
          },
        }),
      ),
    ).toBe(false);
  });

  it('reconoce objetivo por distancia, visibilidad sostenida o ruta inmediata', () => {
    expect(
      objectiveRecognitionIsMet({
        distanceMeters: 300,
        markerVisibleMilliseconds: 0,
        isImmediateRouteTarget: false,
      }),
    ).toBe(true);
    expect(
      objectiveRecognitionIsMet({
        distanceMeters: 1_000,
        markerVisibleMilliseconds: 1_500,
        isImmediateRouteTarget: false,
      }),
    ).toBe(true);
    expect(
      objectiveRecognitionIsMet({
        distanceMeters: null,
        markerVisibleMilliseconds: 0,
        isImmediateRouteTarget: true,
      }),
    ).toBe(true);
  });

  it('habilita Turbo solo con marcha y márgenes seguros', () => {
    const safe = {
      speedKilometersPerHour: 20,
      fuel: 50,
      condition: 80,
      isPaused: false,
      hasBlockingOverlay: false,
      distanceToObjectiveMeters: 500,
    };
    expect(boostContextIsSafe(safe)).toBe(true);
    expect(boostContextIsSafe({ ...safe, fuel: 20 })).toBe(false);
    expect(boostContextIsSafe({ ...safe, condition: 25 })).toBe(false);
    expect(boostContextIsSafe({ ...safe, isPaused: true })).toBe(false);
    expect(
      boostContextIsSafe({ ...safe, distanceToObjectiveMeters: 100 }),
    ).toBe(false);
  });
});

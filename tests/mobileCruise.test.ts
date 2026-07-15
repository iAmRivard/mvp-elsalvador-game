// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mobileCruiseConfig } from '../src/config/mobileControls.config';
import { InputController } from '../src/game/inputController';
import { updateCruiseTarget } from '../src/game/mobileCruise';

afterEach(() => vi.useRealTimers());

describe('velocidad objetivo móvil', () => {
  it('aumenta arriba, mantiene al centro y reduce abajo', () => {
    const increased = updateCruiseTarget(0, 1, 0.5);
    expect(increased).toBe(35);
    expect(updateCruiseTarget(increased, 0, 2)).toBe(increased);
    expect(updateCruiseTarget(increased, -1, 0.2)).toBe(15);
  });

  it('limita el objetivo al rango configurado', () => {
    expect(updateCruiseTarget(80, 1, 1)).toBe(
      mobileCruiseConfig.maximumTargetSpeedKilometersPerHour,
    );
    expect(updateCruiseTarget(10, -1, 1)).toBe(
      mobileCruiseConfig.minimumTargetSpeedKilometersPerHour,
    );
  });

  it('gira sin modificar la velocidad objetivo y mantiene marcha al soltar', () => {
    const input = new InputController();
    input.setMobileCruiseEnabled(true);
    input.setTargetSpeedJoystick(1, 0);
    input.advanceMobileCruise(0, 0.5);
    expect(input.getMobileCruiseTarget()).toMatchObject({
      targetSpeedKilometersPerHour: 35,
      selectedGear: 'slow',
    });

    input.setTargetSpeedJoystick(0, 0.8);
    input.advanceMobileCruise(35 / 3.6, 1);
    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(35);
    expect(input.snapshot().turn).toBe(0.8);
    expect(input.snapshot().throttle).toBeGreaterThan(0);
  });

  it('exige frenar, soltar y un segundo gesto sostenido para reversa', () => {
    const input = new InputController();
    input.setMobileCruiseEnabled(true);
    input.setTargetSpeedJoystick(1, 0);
    input.advanceMobileCruise(0, 0.5);
    input.setTargetSpeedJoystick(-1, 0);
    input.advanceMobileCruise(9, 0.35);
    expect(input.getMobileCruiseTarget()).toMatchObject({
      targetSpeedKilometersPerHour: 0,
      braking: true,
      reversing: false,
      reverseState: 'braking-to-stop',
    });
    expect(input.snapshot().throttle).toBeLessThan(0);

    input.advanceMobileCruise(0, 1);
    expect(input.getMobileCruiseTarget()).toMatchObject({
      braking: false,
      reversing: false,
      reverseState: 'awaiting-release',
    });
    expect(input.snapshot().throttle).toBe(0);

    input.setTargetSpeedJoystick(0, 0);
    input.advanceMobileCruise(0, 0.01);
    expect(input.getMobileCruiseTarget().reverseState).toBe('reverse-armed');

    input.setTargetSpeedJoystick(-1, 0);
    input.advanceMobileCruise(
      0,
      (mobileCruiseConfig.reverseActivationDelayMilliseconds - 1) / 1_000,
    );
    expect(input.getMobileCruiseTarget()).toMatchObject({
      reversing: false,
      reverseState: 'reverse-armed',
    });
    input.advanceMobileCruise(0, 0.001);
    expect(input.getMobileCruiseTarget()).toMatchObject({
      braking: false,
      reversing: true,
      reverseState: 'reversing',
    });
    expect(input.snapshot().throttle).toBeLessThan(0);
  });

  it('no interpreta un primer gesto abajo sostenido como reversa', () => {
    const input = new InputController();
    input.setMobileCruiseEnabled(true);
    input.setTargetSpeedJoystick(-1, 0);
    input.advanceMobileCruise(0, 0.1);
    input.advanceMobileCruise(0, 2);

    expect(input.getMobileCruiseTarget()).toMatchObject({
      reversing: false,
      reverseState: 'awaiting-release',
    });
    expect(input.snapshot().throttle).toBe(0);
  });

  it('Turbo no reemplaza el objetivo y vuelve a él al terminar', () => {
    vi.useFakeTimers();
    const input = new InputController();
    input.setMobileCruiseEnabled(true);
    input.setTargetSpeedJoystick(1, 0);
    input.advanceMobileCruise(0, 0.5);
    input.setTargetSpeedJoystick(0, 0);
    expect(input.activateMobileBoost()).toBe(true);
    expect(input.snapshot()).toMatchObject({ boost: true });
    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(35);

    vi.advanceTimersByTime(
      mobileCruiseConfig.reverseActivationDelayMilliseconds,
    );
    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(35);
    input.clearAllInput();
  });

  it('usa un objetivo efectivo durante 2.5 s y recupera el crucero sin frenazo', () => {
    vi.useFakeTimers();
    const input = new InputController();
    input.setMobileCruiseEnabled(true);
    input.setTargetSpeedJoystick(1, 0);
    input.advanceMobileCruise(0, 0.5);
    input.setTargetSpeedJoystick(0, 0);
    expect(input.activateMobileBoost()).toBe(true);

    for (let step = 0; step < 24; step += 1) {
      vi.advanceTimersByTime(100);
      input.advanceMobileCruise(100 / 3.6, 0.1);
      expect(input.snapshot().throttle).toBeGreaterThanOrEqual(0);
    }
    vi.advanceTimersByTime(100);
    input.advanceMobileCruise(110 / 3.6, 0.1);

    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(35);
    expect(input.snapshot().boost).toBe(false);
    expect(input.snapshot().throttle).toBeGreaterThanOrEqual(
      -mobileCruiseConfig.boostRecoveryMaximumBrake,
    );
    input.clearAllInput();
  });

  it('cancela objetivo y reversa por pérdida de foco o pausa segura', () => {
    const input = new InputController();
    const unbind = input.bindKeyboard(window, vi.fn());
    input.setMobileCruiseEnabled(true);
    input.setTargetSpeedJoystick(1, 0);
    input.advanceMobileCruise(0, 0.5);

    window.dispatchEvent(new Event('blur'));
    expect(input.getMobileCruiseTarget()).toMatchObject({
      targetSpeedKilometersPerHour: 0,
      reverseState: 'forward',
    });
    expect(input.snapshot().throttle).toBe(0);

    input.setTargetSpeedJoystick(-1, 0);
    input.advanceMobileCruise(0, 1);
    input.clearAllInput();
    expect(input.getMobileCruiseTarget()).toMatchObject({
      targetSpeedKilometersPerHour: 0,
      selectedGear: 'stopped',
      braking: false,
      reversing: false,
      reverseState: 'forward',
    });
    unbind();
  });

  it('suspende overlays conservando el objetivo pero desarma reversa', () => {
    const input = new InputController();
    input.setMobileCruiseEnabled(true);
    input.setTargetSpeedJoystick(1, 0.4);
    input.advanceMobileCruise(0, 0.5);
    input.setTargetSpeedJoystick(-1, 0);
    input.advanceMobileCruise(10, 0.1);

    input.suspendForOverlay();

    expect(input.getMobileCruiseTarget()).toMatchObject({
      targetSpeedKilometersPerHour: 25,
      selectedGear: 'slow',
      braking: false,
      reversing: false,
      reverseState: 'forward',
    });
    expect(input.snapshot()).toEqual({
      throttle: 0,
      turn: 0,
      boost: false,
      interact: false,
    });
  });
});

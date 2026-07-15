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

  it('frena a cero y solo activa reversa tras detenerse y esperar', () => {
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
    });
    expect(input.snapshot().throttle).toBeLessThan(0);

    input.advanceMobileCruise(0, 0.2);
    expect(input.getMobileCruiseTarget().reversing).toBe(false);
    input.advanceMobileCruise(0, 0.15);
    expect(input.getMobileCruiseTarget()).toMatchObject({
      braking: false,
      reversing: true,
    });
    expect(input.snapshot().throttle).toBeLessThan(0);
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

  it('cancela el objetivo por pérdida de foco y por pausa segura', () => {
    const input = new InputController();
    const unbind = input.bindKeyboard(window, vi.fn());
    input.setMobileCruiseEnabled(true);
    input.setTargetSpeedJoystick(1, 0);
    input.advanceMobileCruise(0, 0.5);

    window.dispatchEvent(new Event('blur'));
    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(0);
    expect(input.snapshot().throttle).toBe(0);

    input.setTargetSpeedJoystick(1, 0);
    input.advanceMobileCruise(0, 0.5);
    input.clearAllInput();
    expect(input.getMobileCruiseTarget()).toMatchObject({
      targetSpeedKilometersPerHour: 0,
      selectedGear: 'stopped',
      braking: false,
      reversing: false,
    });
    unbind();
  });
});

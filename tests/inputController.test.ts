// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputController } from '../src/game/inputController';

afterEach(() => {
  vi.useRealTimers();
});

describe('keyboard route controls', () => {
  it('requests one recalculation for a non-repeated R press', () => {
    const input = new InputController();
    const pause = vi.fn();
    const recalculate = vi.fn();
    const unbind = input.bindKeyboard(window, pause, recalculate);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyR', repeat: true }),
    );
    expect(recalculate).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
    unbind();
  });

  it('mantiene un pulso táctil el tiempo suficiente para telemetría', () => {
    vi.useFakeTimers();
    const input = new InputController();
    input.setPointerAction('interact', true);
    input.releasePointerAction('interact', 250);

    expect(input.snapshot().interact).toBe(true);
    vi.advanceTimersByTime(249);
    expect(input.snapshot().interact).toBe(true);
    vi.advanceTimersByTime(1);
    expect(input.snapshot().interact).toBe(false);
  });

  it('combina teclado y fuentes táctiles con suma limitada', () => {
    const input = new InputController();
    const unbind = input.bindKeyboard(window, vi.fn());
    input.setJoystickTurn(0.35);
    input.setTouchThrottle(0.62);

    expect(input.snapshot()).toMatchObject({ throttle: 0.62, turn: 0.35 });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    expect(input.snapshot().turn).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    expect(input.snapshot().turn).toBe(0.35);
    unbind();
  });

  it('suspende el crucero por entrada manual y lo cancela al frenar', () => {
    const input = new InputController();
    input.setAutoThrottle(true, 0.72);
    expect(input.snapshot().throttle).toBe(0.72);
    expect(input.getAutoThrottleStatus()).toBe('active');

    input.setTouchThrottle(0.4);
    expect(input.snapshot().throttle).toBe(0.4);
    expect(input.getAutoThrottleStatus()).toBe('suspended');
    input.setTouchThrottle(0);
    expect(input.snapshot().throttle).toBe(0.72);

    input.setTouchThrottle(-1);
    expect(input.snapshot().throttle).toBe(-1);
    expect(input.getAutoThrottleStatus()).toBe('off');
  });

  it('limpia todas las fuentes y temporizadores de forma central', () => {
    vi.useFakeTimers();
    const input = new InputController();
    input.setPointerAction('boost', true);
    input.setPointerAction('interact', true);
    input.releasePointerAction('interact', 250);
    input.setTouchThrottle(1);
    input.setJoystickTurn(-0.4);
    input.setAutoThrottle(true);
    input.setPointerActive(4, true);

    input.clearAllInput();
    expect(input.snapshot()).toEqual({
      throttle: 0,
      turn: 0,
      boost: false,
      interact: false,
    });
    expect(input.getDiagnostics().pointerActive).toBe(false);
    vi.runAllTimers();
    expect(input.snapshot().interact).toBe(false);
  });

  it('limpia teclado, punteros y crucero cuando la ventana pierde foco', () => {
    const input = new InputController();
    const unbind = input.bindKeyboard(window, vi.fn());
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    input.setJoystickTurn(0.6);
    input.setAutoThrottle(true);
    input.setPointerAction('boost', true);
    input.activateMobileBoost();

    window.dispatchEvent(new Event('blur'));

    expect(input.snapshot()).toEqual({
      throttle: 0,
      turn: 0,
      boost: false,
      interact: false,
    });
    expect(input.getAutoThrottleStatus()).toBe('off');
    expect(input.getMobileBoostState().active).toBe(false);
    unbind();
  });

  it('activa Turbo móvil por toque, termina y respeta el enfriamiento', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
    const input = new InputController();

    expect(input.activateMobileBoost({ fuel: 50, condition: 80 })).toBe(true);
    expect(input.snapshot().boost).toBe(true);
    expect(input.getMobileBoostState()).toMatchObject({
      active: true,
      remainingMilliseconds: 2_500,
      cooldownRemainingMilliseconds: 0,
    });
    expect(input.activateMobileBoost()).toBe(false);

    vi.advanceTimersByTime(2_500);
    expect(input.snapshot().boost).toBe(false);
    expect(input.getMobileBoostState()).toMatchObject({
      active: false,
      remainingMilliseconds: 0,
      cooldownRemainingMilliseconds: 1_800,
    });
    expect(input.activateMobileBoost()).toBe(false);

    vi.advanceTimersByTime(1_800);
    expect(input.getMobileBoostState()).toEqual({
      active: false,
      remainingMilliseconds: 0,
      cooldownRemainingMilliseconds: 0,
    });
    expect(input.activateMobileBoost()).toBe(true);
    input.clearAllInput();
  });

  it('cancela AUTO y Turbo móvil al frenar o limpiar una interrupción', () => {
    vi.useFakeTimers();
    const input = new InputController();
    input.setAutoThrottle(true);
    input.activateMobileBoost();

    input.setPointerAction('backward', true);
    expect(input.getAutoThrottleStatus()).toBe('off');
    expect(input.getMobileBoostState().active).toBe(false);
    expect(input.snapshot()).toMatchObject({ throttle: -1, boost: false });

    input.setPointerAction('backward', false);
    input.setAutoThrottle(true);
    input.activateMobileBoost();
    input.clearAllInput();
    expect(input.getAutoThrottleStatus()).toBe('off');
    expect(input.getMobileBoostState()).toEqual({
      active: false,
      remainingMilliseconds: 0,
      cooldownRemainingMilliseconds: 0,
    });
  });

  it('rechaza Turbo móvil sin combustible o con condición cero', () => {
    const input = new InputController();
    expect(input.activateMobileBoost({ fuel: 0, condition: 100 })).toBe(false);
    expect(input.activateMobileBoost({ fuel: 50, condition: 0 })).toBe(false);
    expect(input.snapshot().boost).toBe(false);
  });

  it('permite Turbo temporal mientras el crucero mantiene la marcha', () => {
    vi.useFakeTimers();
    const input = new InputController();
    input.setAutoThrottle(true, 0.72);
    expect(input.activateMobileBoost()).toBe(true);
    expect(input.snapshot()).toMatchObject({ throttle: 0.72, boost: true });
    input.clearAllInput();
  });

  it('mantiene Shift como Turbo sostenido de escritorio', () => {
    const input = new InputController();
    const unbind = input.bindKeyboard(window, vi.fn());
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
    expect(input.snapshot().boost).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
    expect(input.snapshot().boost).toBe(false);
    unbind();
  });
});

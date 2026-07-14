// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { InputController } from '../src/game/inputController';

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
    vi.useRealTimers();
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
    input.setPointerActive(true);

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
    vi.useRealTimers();
  });
});

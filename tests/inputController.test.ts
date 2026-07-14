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
});

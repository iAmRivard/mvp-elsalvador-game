// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { triggerHaptic } from '../src/game/haptics';

describe('hápticos opcionales', () => {
  afterEach(() => vi.restoreAllMocks());

  it('vibra sólo cuando la preferencia está activa', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    });

    triggerHaptic('button', false);
    expect(vibrate).not.toHaveBeenCalled();
    triggerHaptic('boost', true);
    expect(vibrate).toHaveBeenCalledWith([18, 28, 18]);
  });

  it('no falla si el navegador rechaza la vibración', () => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('bloqueada');
      }),
    });
    expect(() => triggerHaptic('collision', true)).not.toThrow();
  });
});

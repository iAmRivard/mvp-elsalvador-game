// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTO_THROTTLE_HINT_KEY,
  consumeAutoThrottleHint,
  consumeMobileActionLabels,
  MOBILE_ACTION_LABELS_KEY,
} from '../src/game/mobileControlHelp';

describe('ayuda inicial del crucero', () => {
  beforeEach(() => window.localStorage.clear());

  it('se consume una sola vez', () => {
    expect(consumeAutoThrottleHint()).toBe(true);
    expect(window.localStorage.getItem(AUTO_THROTTLE_HINT_KEY)).toBe('true');
    expect(consumeAutoThrottleHint()).toBe(false);
  });

  it('muestra las etiquetas sólo una vez por sesión', () => {
    expect(consumeMobileActionLabels()).toBe(true);
    expect(window.sessionStorage.getItem(MOBILE_ACTION_LABELS_KEY)).toBe(
      'true',
    );
    expect(consumeMobileActionLabels()).toBe(false);
  });
});

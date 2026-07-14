// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTO_THROTTLE_HINT_KEY,
  consumeAutoThrottleHint,
} from '../src/game/mobileControlHelp';

describe('ayuda inicial del crucero', () => {
  beforeEach(() => window.localStorage.clear());

  it('se consume una sola vez', () => {
    expect(consumeAutoThrottleHint()).toBe(true);
    expect(window.localStorage.getItem(AUTO_THROTTLE_HINT_KEY)).toBe('true');
    expect(consumeAutoThrottleHint()).toBe(false);
  });
});

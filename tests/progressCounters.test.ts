import { describe, expect, it } from 'vitest';
import { progressCounter } from '../src/game/progressCounters';

describe('contadores dinámicos', () => {
  it('deriva total y completados del catálogo recibido', () => {
    expect(progressCounter(['a', 'b', 'c'], ['a', 'extra'])).toEqual({
      completed: 1,
      total: 3,
    });
    expect(progressCounter(['a', 'b', 'c', 'd'], ['a', 'd'])).toEqual({
      completed: 2,
      total: 4,
    });
  });
});

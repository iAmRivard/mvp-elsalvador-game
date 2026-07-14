import { describe, expect, it } from 'vitest';
import { advancePlayerFrame } from '../src/game/gameLoop';
import type { PlayerInput, PlayerRuntime } from '../src/types/game';

const player: PlayerRuntime = {
  longitude: -89.191111,
  latitude: 13.6975,
  heading: 0,
  speedMetersPerSecond: 12,
  fuel: 80,
  totalDistanceMeters: 250,
};

const forwardInput: PlayerInput = {
  throttle: 1,
  turn: 0,
  boost: false,
  interact: false,
};

describe('avance del game loop', () => {
  it('congela por completo el runtime mientras la partida esta pausada', () => {
    expect(advancePlayerFrame(player, forwardInput, 0.05, true)).toBe(player);
  });

  it('reanuda el movimiento usando la configuracion solicitada', () => {
    const next = advancePlayerFrame(player, forwardInput, 0.05, false, {
      steeringSensitivity: 'high',
    });

    expect(next).not.toBe(player);
    expect(next.speedMetersPerSecond).toBeGreaterThan(
      player.speedMetersPerSecond,
    );
    expect(next.totalDistanceMeters).toBeGreaterThan(
      player.totalDistanceMeters,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { movePlayer, normalizeHeading, stepPlayer } from '../src/game/movement';
import type { PlayerInput, PlayerRuntime } from '../src/types/game';

const player: PlayerRuntime = {
  longitude: -89.2182,
  latitude: 13.6929,
  heading: 0,
  speedMetersPerSecond: 0,
  fuel: 100,
  totalDistanceMeters: 0,
};

const idleInput: PlayerInput = {
  throttle: 0,
  turn: 0,
  boost: false,
  interact: false,
};

describe('movimiento geográfico del jugador', () => {
  it('normaliza el rumbo al intervalo de 0 a 360 grados', () => {
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(370)).toBe(10);
  });

  it('avanza aproximadamente diez metros al norte', () => {
    const result = movePlayer({
      longitude: player.longitude,
      latitude: player.latitude,
      heading: 0,
      speedMetersPerSecond: 10,
      deltaTimeSeconds: 1,
    });

    expect(result.distanceMeters).toBe(10);
    expect(result.latitude).toBeGreaterThan(player.latitude);
    expect(result.longitude).toBeCloseTo(player.longitude, 6);
  });

  it('no consume combustible ni distancia cuando está detenido', () => {
    expect(stepPlayer(player, idleInput, 0.016)).toEqual(player);
  });

  it('acelera gradualmente y consume combustible según la distancia', () => {
    const next = stepPlayer(player, { ...idleInput, throttle: 1 }, 0.05);

    expect(next.speedMetersPerSecond).toBeGreaterThan(0);
    expect(next.speedMetersPerSecond).toBeLessThan(24);
    expect(next.totalDistanceMeters).toBeGreaterThan(0);
    expect(next.fuel).toBeLessThan(100);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  advancePlayerFrame,
  startPlayerGameLoop,
  type PlayerSimulationSample,
} from '../src/game/gameLoop';
import { InputController } from '../src/game/inputController';
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
  afterEach(() => vi.unstubAllGlobals());

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

  it('entrega los subpasos acumulados en cada actualización de telemetría', () => {
    let nextFrame: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      nextFrame = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const telemetryUpdates: PlayerSimulationSample[][] = [];
    const realTimeDeltas: number[] = [];
    const startedAt = performance.now();
    const loop = startPlayerGameLoop({
      initialPlayer: { ...player, speedMetersPerSecond: 38 },
      input: new InputController(),
      isPaused: () => false,
      getMovementOptions: () => ({
        travel: {
          normalMaximumSpeedMetersPerSecond: 26,
          boostMaximumSpeedMetersPerSecond: 38,
          geographicTravelScale: 5,
          accelerationMetersPerSecondSquared: 9,
          brakingMetersPerSecondSquared: 14,
          coastDecelerationMetersPerSecondSquared: 5,
        },
      }),
      onVisualUpdate: vi.fn(),
      onTelemetryUpdate: (_runtime, samples, elapsedRealTimeSeconds) => {
        realTimeDeltas.push(elapsedRealTimeSeconds);
        telemetryUpdates.push([...samples]);
      },
    });
    const frame = nextFrame as FrameRequestCallback | null;
    if (!frame) throw new Error('The game loop did not schedule a frame.');

    frame(startedAt + 137);

    expect(telemetryUpdates).toHaveLength(2);
    const samples = telemetryUpdates.at(-1);
    if (!samples) throw new Error('Telemetry did not receive movement samples.');
    expect(samples.length).toBeGreaterThan(1);
    expect(realTimeDeltas.at(-1)).toBeCloseTo(0.137, 2);
    const latestSample = samples.at(-1);
    if (!latestSample) throw new Error('The telemetry sample list is empty.');
    expect(latestSample.player).toEqual(loop.getPlayer());
    loop.stop();
  });
});

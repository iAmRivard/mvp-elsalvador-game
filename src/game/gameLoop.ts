import type { InputController } from './inputController';
import { movementSubstepConfig } from '../config/movementSubstep.config';
import {
  stepPlayer,
  stepPlayerDetailed,
  type PlayerStepEnvironment,
  type PlayerStepSample,
  type StepPlayerOptions,
} from './movement';
import type { PlayerInput, PlayerRuntime } from '../types/game';

export interface PlayerSimulationSample extends PlayerStepSample {
  input: PlayerInput;
}

export interface PlayerGameLoopOptions {
  initialPlayer: PlayerRuntime;
  input: InputController;
  isPaused: () => boolean;
  getMovementOptions?: () => StepPlayerOptions;
  onVisualUpdate: (player: PlayerRuntime, timestamp: number) => void;
  onTelemetryUpdate: (
    player: PlayerRuntime,
    samples: readonly PlayerSimulationSample[],
    elapsedRealTimeSeconds: number,
  ) => void;
}

export function advancePlayerFrame(
  player: PlayerRuntime,
  input: ReturnType<InputController['snapshot']>,
  deltaTimeSeconds: number,
  isPaused: boolean,
  movementOptions?: StepPlayerOptions,
): PlayerRuntime {
  return isPaused
    ? player
    : stepPlayer(player, input, deltaTimeSeconds, movementOptions);
}

export interface PlayerGameLoop {
  stop: () => void;
  getPlayer: () => PlayerRuntime;
  getEnvironment: () => PlayerStepEnvironment;
  getSurface: () => PlayerStepEnvironment['surface'];
  restoreFuel: (amount: number) => void;
  replacePlayer: (player: PlayerRuntime) => void;
}

export function startPlayerGameLoop(
  options: PlayerGameLoopOptions,
): PlayerGameLoop {
  let player = { ...options.initialPlayer };
  let previousTimestamp = performance.now();
  let lastTelemetryTimestamp = previousTimestamp;
  let animationFrame = 0;
  let stopped = false;
  let pendingSamples: PlayerSimulationSample[] = [];
  let environment: PlayerStepEnvironment = {
    surface: 'primary',
    speedMultiplier: 1,
    fuelMultiplier: 1,
    roadDistanceMeters: null,
    movementBlockedBy: null,
  };

  options.onVisualUpdate(player, previousTimestamp);
  options.onTelemetryUpdate(player, [], 0);

  const frame = (timestamp: number) => {
    if (stopped) return;
    const deltaTimeSeconds = Math.min(
      movementSubstepConfig.maximumDeltaTimeSeconds,
      Math.max(0, (timestamp - previousTimestamp) / 1000),
    );
    previousTimestamp = timestamp;

    if (!options.isPaused()) {
      options.input.advanceMobileCruise(
        player.speedMetersPerSecond,
        deltaTimeSeconds,
      );
      const input = options.input.snapshot();
      options.input.markInputConsumed(performance.now());
      const previousPlayer = player;
      const result = stepPlayerDetailed(
        player,
        input,
        deltaTimeSeconds,
        options.getMovementOptions?.(),
      );
      player = result.player;
      if (
        player.longitude !== previousPlayer.longitude ||
        player.latitude !== previousPlayer.latitude
      ) {
        options.input.markInputPositionChanged(performance.now());
      }
      environment = result.environment;
      pendingSamples.push(
        ...result.samples.map((sample) => ({ ...sample, input })),
      );
    }
    options.onVisualUpdate(player, timestamp);

    if (timestamp - lastTelemetryTimestamp >= 100) {
      const telemetrySamples = pendingSamples;
      pendingSamples = [];
      options.onTelemetryUpdate(
        player,
        telemetrySamples,
        Math.max(0, (timestamp - lastTelemetryTimestamp) / 1_000),
      );
      lastTelemetryTimestamp = timestamp;
    }

    animationFrame = requestAnimationFrame(frame);
  };

  animationFrame = requestAnimationFrame(frame);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
    },
    getPlayer: () => ({ ...player }),
    getEnvironment: () => ({ ...environment }),
    getSurface: () => environment.surface,
    restoreFuel: (amount) => {
      player = {
        ...player,
        fuel: Math.min(100, player.fuel + Math.max(0, amount)),
      };
    },
    replacePlayer: (nextPlayer) => {
      player = { ...nextPlayer };
      pendingSamples = [];
      previousTimestamp = performance.now();
    },
  };
}

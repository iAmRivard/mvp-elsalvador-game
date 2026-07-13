import type { InputController } from './inputController';
import { stepPlayer } from './movement';
import type { PlayerRuntime } from '../types/game';

export interface PlayerGameLoopOptions {
  initialPlayer: PlayerRuntime;
  input: InputController;
  isPaused: () => boolean;
  onVisualUpdate: (player: PlayerRuntime, timestamp: number) => void;
  onTelemetryUpdate: (player: PlayerRuntime) => void;
}

export interface PlayerGameLoop {
  stop: () => void;
  getPlayer: () => PlayerRuntime;
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

  options.onVisualUpdate(player, previousTimestamp);
  options.onTelemetryUpdate(player);

  const frame = (timestamp: number) => {
    if (stopped) return;
    const deltaTimeSeconds = Math.min(
      0.05,
      Math.max(0, (timestamp - previousTimestamp) / 1000),
    );
    previousTimestamp = timestamp;

    if (!options.isPaused()) {
      player = stepPlayer(player, options.input.snapshot(), deltaTimeSeconds);
    }
    options.onVisualUpdate(player, timestamp);

    if (timestamp - lastTelemetryTimestamp >= 100) {
      options.onTelemetryUpdate(player);
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
    restoreFuel: (amount) => {
      player = {
        ...player,
        fuel: Math.min(100, player.fuel + Math.max(0, amount)),
      };
    },
    replacePlayer: (nextPlayer) => {
      player = { ...nextPlayer };
      previousTimestamp = performance.now();
    },
  };
}

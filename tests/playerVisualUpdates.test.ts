import { describe, expect, it, vi } from 'vitest';
import {
  PlayerVisualUpdateCoordinator,
  type PlayerVisualUpdateSinks,
} from '../src/map/playerVisualUpdates';
import type { PlayerRuntime } from '../src/types/game';

function player(longitude: number): PlayerRuntime {
  return {
    longitude,
    latitude: 13.69,
    heading: 0,
    speedMetersPerSecond: 5,
    fuel: 75,
    totalDistanceMeters: 0,
  };
}

function createCoordinator() {
  const sinks: PlayerVisualUpdateSinks = {
    updateFallback: vi.fn(),
    updateThree: vi.fn(),
    setDrivingEffects: vi.fn(() => true),
  };
  return {
    coordinator: new PlayerVisualUpdateCoordinator(sinks),
    sinks,
  };
}

describe('player visual update coordinator', () => {
  it('stops updating the hidden fallback while Three continues per frame', () => {
    const { coordinator, sinks } = createCoordinator();
    coordinator.setFallbackHidden(true);

    coordinator.update(player(-89.19), false);
    coordinator.update(player(-89.191), false);
    coordinator.update(player(-89.192), false);

    expect(sinks.updateFallback).not.toHaveBeenCalled();
    expect(sinks.updateThree).toHaveBeenCalledTimes(3);
  });

  it('resynchronizes the latest player before the fallback becomes visible', () => {
    const { coordinator, sinks } = createCoordinator();
    coordinator.setFallbackHidden(true);
    coordinator.update(player(-89.19), false);
    coordinator.update(player(-89.2), false);

    coordinator.setFallbackHidden(false);

    expect(sinks.updateFallback).toHaveBeenCalledTimes(1);
    expect(sinks.updateFallback).toHaveBeenLastCalledWith(player(-89.2));
  });

  it('applies driving effects only when road state changes', () => {
    const { coordinator, sinks } = createCoordinator();

    coordinator.update(player(-89.19), false);
    coordinator.update(player(-89.191), false);
    coordinator.update(player(-89.192), true);
    coordinator.update(player(-89.193), true);
    coordinator.update(player(-89.194), false);

    expect(sinks.setDrivingEffects).toHaveBeenCalledTimes(3);
    expect(sinks.setDrivingEffects).toHaveBeenNthCalledWith(1, false);
    expect(sinks.setDrivingEffects).toHaveBeenNthCalledWith(2, true);
    expect(sinks.setDrivingEffects).toHaveBeenNthCalledWith(3, false);
  });

  it('retries the current effect when the Three sink was not ready', () => {
    let ready = false;
    const sinks: PlayerVisualUpdateSinks = {
      updateFallback: vi.fn(),
      updateThree: vi.fn(),
      setDrivingEffects: vi.fn(() => ready),
    };
    const coordinator = new PlayerVisualUpdateCoordinator(sinks);

    coordinator.update(player(-89.19), true);
    ready = true;
    coordinator.update(player(-89.191), true);
    coordinator.update(player(-89.192), true);

    expect(sinks.setDrivingEffects).toHaveBeenCalledTimes(2);
  });
});

import type { PlayerRuntime } from '../types/game';

export interface PlayerVisualUpdateSinks {
  updateFallback: (player: PlayerRuntime) => void;
  updateThree: (player: PlayerRuntime) => void;
  setDrivingEffects: (offroad: boolean) => boolean;
}

export class PlayerVisualUpdateCoordinator {
  private readonly sinks: PlayerVisualUpdateSinks;
  private fallbackHidden = false;
  private fallbackDirty = false;
  private latestPlayer: PlayerRuntime | null = null;
  private lastAppliedOffroad: boolean | null = null;

  constructor(sinks: PlayerVisualUpdateSinks) {
    this.sinks = sinks;
  }

  setFallbackHidden(hidden: boolean): void {
    if (this.fallbackHidden === hidden) return;
    this.fallbackHidden = hidden;
    if (!hidden && this.fallbackDirty && this.latestPlayer) {
      this.sinks.updateFallback(this.latestPlayer);
      this.fallbackDirty = false;
    }
  }

  update(player: PlayerRuntime, offroad: boolean): void {
    this.latestPlayer = player;
    if (this.fallbackHidden) {
      this.fallbackDirty = true;
    } else {
      this.sinks.updateFallback(player);
      this.fallbackDirty = false;
    }
    this.sinks.updateThree(player);
    if (
      this.lastAppliedOffroad !== offroad &&
      this.sinks.setDrivingEffects(offroad)
    ) {
      this.lastAppliedOffroad = offroad;
    }
  }
}

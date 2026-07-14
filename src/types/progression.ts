import type { PlayerRuntime } from './game';

export interface InventoryItemDefinition {
  id: string;
  name: string;
  description: string;
  type: 'consumable' | 'mission' | 'vehicle-part' | 'artifact';
  maximumQuantity: number;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export interface VehicleState {
  condition: number;
  fuel: number;
  maximumFuel: number;
}

export interface MissionObjectiveProgress {
  value: number;
  target: number;
  elapsedSeconds: number;
  durationSeconds: number | null;
}

export type MissionObjectiveProgressMap = Record<
  string,
  MissionObjectiveProgress
>;

export type CheckpointReason =
  | 'new-game'
  | 'mission-start'
  | 'city'
  | 'fuel-station'
  | 'objective'
  | 'chapter';

export interface CheckpointSnapshot {
  id: string;
  createdAt: string;
  reason: CheckpointReason;
  player: PlayerRuntime;
  vehicle: VehicleState;
  inventory: InventoryEntry[];
  energy: number;
  activeMissionId: string | null;
  activeMissionCompletedObjectiveIds: string[];
  activeMissionObjectiveProgress: MissionObjectiveProgressMap;
}

export type RecoveryReason =
  'fuel' | 'condition' | 'timed-objective' | 'out-of-bounds';

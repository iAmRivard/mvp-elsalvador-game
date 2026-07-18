import type {
  MissionObjectiveProgressMap,
  RecoveryReason,
} from '../types/progression';
import type { RoadSurface } from '../types/roads';
import type { VehicleId } from '../types/vehicles';

export interface VehicleAudioObservableState {
  telemetry: { speedMetersPerSecond: number };
  driving: { surface: RoadSurface };
  isPaused: boolean;
  selectedVehicleId: VehicleId;
}

export interface AdaptiveMusicObservableState {
  activeMissionId: string | null;
  activeMissionCompletedObjectiveIds: readonly string[];
  activeMissionObjectiveProgress: MissionObjectiveProgressMap;
  missionTimerCountdownSeconds: number;
  recoveryReason: RecoveryReason | null;
  activeRadioEventId: string | null;
  isPaused: boolean;
}

export function vehicleAudioStateChanged(
  state: VehicleAudioObservableState,
  previousState: VehicleAudioObservableState,
): boolean {
  return (
    state.telemetry.speedMetersPerSecond !==
      previousState.telemetry.speedMetersPerSecond ||
    state.driving.surface !== previousState.driving.surface ||
    state.isPaused !== previousState.isPaused ||
    state.selectedVehicleId !== previousState.selectedVehicleId
  );
}

export function adaptiveMusicStateChanged(
  state: AdaptiveMusicObservableState,
  previousState: AdaptiveMusicObservableState,
): boolean {
  return (
    state.activeMissionId !== previousState.activeMissionId ||
    state.activeMissionCompletedObjectiveIds !==
      previousState.activeMissionCompletedObjectiveIds ||
    state.activeMissionObjectiveProgress !==
      previousState.activeMissionObjectiveProgress ||
    state.missionTimerCountdownSeconds !==
      previousState.missionTimerCountdownSeconds ||
    state.recoveryReason !== previousState.recoveryReason ||
    state.activeRadioEventId !== previousState.activeRadioEventId ||
    state.isPaused !== previousState.isPaused
  );
}

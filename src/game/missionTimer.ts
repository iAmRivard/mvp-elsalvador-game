import type { Mission, MissionObjective } from '../data/missions';
import type { MissionObjectiveProgressMap } from '../types/progression';
import { objectiveIsAvailable } from './missions';

export type MissionTimerUrgency = 'normal' | 'warning' | 'urgent' | 'critical';

export interface ActiveMissionTimer {
  objective: MissionObjective;
  durationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
}

export function activeMissionTimer(
  mission: Mission | null,
  completedObjectiveIds: readonly string[],
  objectiveProgress: MissionObjectiveProgressMap,
): ActiveMissionTimer | null {
  if (!mission) return null;
  const completed = new Set(completedObjectiveIds);
  const objective = mission.objectives.find(
    (candidate) =>
      candidate.type === 'timed' &&
      !completed.has(candidate.id) &&
      objectiveIsAvailable(candidate, completed),
  );
  if (!objective) return null;
  const progress = objectiveProgress[objective.id];
  const durationSeconds = Math.max(
    1,
    progress?.durationSeconds ?? objective.durationSeconds ?? 60,
  );
  const elapsedSeconds = Math.max(0, progress?.elapsedSeconds ?? 0);
  return {
    objective,
    durationSeconds,
    elapsedSeconds,
    remainingSeconds: Math.max(0, durationSeconds - elapsedSeconds),
  };
}

export function formatMissionTimer(seconds: number): string {
  const rounded = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(rounded / 60);
  return `${String(minutes).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

export function missionTimerUrgency(
  remainingSeconds: number,
): MissionTimerUrgency {
  if (remainingSeconds <= 10) return 'critical';
  if (remainingSeconds <= 30) return 'urgent';
  if (remainingSeconds <= 60) return 'warning';
  return 'normal';
}

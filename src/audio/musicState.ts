import type { MusicState } from '../config/audio.config';

export function musicStateForGame(
  activeMissionId: string | null,
  timedObjectiveActive: boolean,
  recoveryActive = false,
): MusicState {
  if (recoveryActive) return 'silent';
  if (timedObjectiveActive) return 'timed';
  return activeMissionId ? 'mission' : 'exploration';
}

import { useEffect, useRef } from 'react';
import { missionById } from '../../data/missions';
import { triggerHaptic } from '../../game/haptics';
import {
  activeMissionTimer,
  formatMissionTimer,
  missionTimerUrgency,
} from '../../game/missionTimer';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';

export function MissionTimer() {
  const missionId = useGameStore((state) => state.activeMissionId);
  const completedObjectiveIds = useGameStore(
    (state) => state.activeMissionCompletedObjectiveIds,
  );
  const objectiveProgress = useGameStore(
    (state) => state.activeMissionObjectiveProgress,
  );
  const countdownSeconds = useGameStore(
    (state) => state.missionTimerCountdownSeconds,
  );
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const previousSecond = useRef<number | null>(null);
  const timer = activeMissionTimer(
    missionId ? (missionById.get(missionId) ?? null) : null,
    completedObjectiveIds,
    objectiveProgress,
  );
  const remainingSecond = timer ? Math.ceil(timer.remainingSeconds) : null;

  useEffect(() => {
    if (
      remainingSecond !== null &&
      remainingSecond <= 10 &&
      remainingSecond > 0 &&
      previousSecond.current !== remainingSecond
    ) {
      triggerHaptic('timer-warning', hapticsEnabled);
    }
    previousSecond.current = remainingSecond;
  }, [hapticsEnabled, remainingSecond]);

  if (countdownSeconds > 0) {
    return (
      <aside className="mission-countdown" role="status" aria-live="assertive">
        <span>PREPÁRATE</span>
        <strong>{Math.max(1, Math.ceil(countdownSeconds))}</strong>
      </aside>
    );
  }
  if (!timer) return null;
  const urgency = missionTimerUrgency(timer.remainingSeconds);
  const warning =
    remainingSecond === 60
      ? 'Queda 1 minuto'
      : remainingSecond === 30
        ? 'Quedan 30 segundos'
        : remainingSecond !== null && remainingSecond <= 10
          ? String(remainingSecond)
          : null;

  return (
    <aside
      className={`mission-timer mission-timer--${urgency}`}
      role="timer"
      aria-live={urgency === 'critical' ? 'assertive' : 'polite'}
      data-music-state="timed"
    >
      <span>SEÑAL INESTABLE</span>
      <strong>{formatMissionTimer(timer.remainingSeconds)}</strong>
      <small>{timer.objective.label}</small>
      {warning && <em>{warning}</em>}
    </aside>
  );
}

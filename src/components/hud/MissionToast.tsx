import { missionById } from '../../data/missions';
import { missionRewardLabel } from '../../game/missions';
import { useGameStore } from '../../store/gameStore';

export function MissionToast() {
  const missionId = useGameStore((state) => state.lastCompletedMissionId);
  const dismiss = useGameStore((state) => state.dismissMissionCompletion);
  const mission = missionId ? missionById.get(missionId) : null;
  if (!mission) return null;

  return (
    <aside className="mission-toast" role="status" aria-live="polite">
      <span className="mission-toast__icon" aria-hidden="true">
        ✓
      </span>
      <div>
        <span>Misión completada</span>
        <strong>{mission.title}</strong>
        <small>{mission.rewards.map(missionRewardLabel).join(' · ')}</small>
      </div>
      <button type="button" aria-label="Cerrar recompensa" onClick={dismiss}>
        ×
      </button>
    </aside>
  );
}

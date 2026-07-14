import { locationById } from '../../data/locations';
import { missionById } from '../../data/missions';
import {
  missionChoiceConsequence,
  selectedMissionChoiceOption,
} from '../../game/missionChoices';
import { getRecommendedMission } from '../../game/missionRecommendations';
import { missionRewardLabel } from '../../game/missions';
import { useGameStore } from '../../store/gameStore';

export function MissionToast() {
  const missionId = useGameStore((state) => state.lastCompletedMissionId);
  const completedMissionIds = useGameStore(
    (state) => state.completedMissionIds,
  );
  const activeMissionId = useGameStore((state) => state.activeMissionId);
  const telemetry = useGameStore((state) => state.telemetry);
  const choices = useGameStore((state) => state.missionChoiceSelections);
  const dismiss = useGameStore((state) => state.dismissMissionCompletion);
  const startMission = useGameStore((state) => state.startMission);
  const requestRoute = useGameStore(
    (state) => state.requestMissionRouteRecalculation,
  );
  const requestStoryLog = useGameStore((state) => state.requestStoryLog);
  const mission = missionId ? missionById.get(missionId) : null;
  if (!mission) return null;
  const recommendation = getRecommendedMission(
    completedMissionIds,
    activeMissionId,
    [telemetry.longitude, telemetry.latitude],
  );
  const nextMission = recommendation
    ? missionById.get(recommendation.missionId)
    : null;
  const selectedChoice = selectedMissionChoiceOption(mission.id, choices);
  const nextStart = nextMission
    ? locationById.get(nextMission.startLocationId)
    : null;

  return (
    <aside className="mission-toast" role="status" aria-live="polite">
      <header>
        <span className="mission-toast__icon" aria-hidden="true">
          ✓
        </span>
        <div>
          <span>Misión completada</span>
          <h2>{mission.title}</h2>
        </div>
        <button type="button" aria-label="Cerrar recompensa" onClick={dismiss}>
          ×
        </button>
      </header>
      <p>{mission.completionSummary}</p>
      {selectedChoice && (
        <p className="mission-toast__consequence">
          {missionChoiceConsequence(selectedChoice)}
        </p>
      )}
      <div className="mission-toast__rewards">
        {mission.rewards.map((reward, index) => (
          <span key={`${reward.type}-${String(index)}`}>
            {missionRewardLabel(reward)}
          </span>
        ))}
      </div>
      {nextMission && recommendation && (
        <div className="mission-toast__next">
          <small>Siguiente misión</small>
          <strong>{nextMission.title}</strong>
          <span>Comienza en {nextStart?.name ?? 'el punto marcado'}</span>
        </div>
      )}
      <footer>
        {nextMission && recommendation && (
          <button
            type="button"
            className="mission-toast__continue"
            onClick={() => {
              dismiss();
              if (recommendation.canStartNow) startMission(nextMission.id);
              else requestRoute();
            }}
          >
            {recommendation.canStartNow
              ? `Iniciar ${nextMission.title}`
              : `Ir al inicio de ${nextMission.title}`}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            requestStoryLog('missions');
            dismiss();
          }}
        >
          Ver bitácora
        </button>
      </footer>
    </aside>
  );
}

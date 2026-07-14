import { missionById } from '../../data/missions';
import { useGameStore } from '../../store/gameStore';

const riskLabels = {
  low: 'Riesgo bajo',
  medium: 'Riesgo medio',
  high: 'Riesgo alto',
} as const;

function formatDistance(distanceMeters: number): string {
  return `${(distanceMeters / 1_000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min aprox.`;
}

export function MissionChoiceDialog() {
  const missionId = useGameStore((state) => state.activeMissionId);
  const objectiveId = useGameStore(
    (state) => state.activeMissionChoiceObjectiveId,
  );
  const selectMissionChoice = useGameStore(
    (state) => state.selectMissionChoice,
  );
  const cancelMissionChoice = useGameStore(
    (state) => state.cancelMissionChoice,
  );
  const mission = missionId ? missionById.get(missionId) : null;
  const objective = mission?.objectives.find(
    (candidate) => candidate.id === objectiveId,
  );
  const choice = objective?.choice;
  if (!mission || !objective || !choice) return null;

  return (
    <div className="choice-dialog-backdrop">
      <section
        className="choice-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="choice-title"
        aria-describedby="choice-prompt"
      >
        <span className="paused-label">JUEGO EN PAUSA</span>
        <span className="choice-dialog__eyebrow">Decisión de ruta</span>
        <h2 id="choice-title">Elige el desvío</h2>
        <p id="choice-prompt">{choice.prompt}</p>
        <div className="choice-options">
          {choice.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`choice-option choice-option--${option.risk}`}
              onClick={() => selectMissionChoice(option.id)}
            >
              <span>
                <strong>{option.label}</strong>
                <small>{riskLabels[option.risk]}</small>
              </span>
              <p>{option.description}</p>
              <dl>
                <div>
                  <dt>Distancia</dt>
                  <dd>{formatDistance(option.estimatedDistanceMeters)}</dd>
                </div>
                <div>
                  <dt>Duración</dt>
                  <dd>{formatDuration(option.estimatedDurationSeconds)}</dd>
                </div>
                <div>
                  <dt>Consumo</dt>
                  <dd>
                    {(option.fuelMultiplier ?? 1) <= 1 ? 'Menor' : 'Mayor'}
                  </dd>
                </div>
              </dl>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="choice-dialog__back"
          onClick={cancelMissionChoice}
        >
          Volver al mapa
        </button>
      </section>
    </div>
  );
}

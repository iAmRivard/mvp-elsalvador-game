import { useEffect, useState } from 'react';
import { locationById } from '../../data/locations';
import { missionById, missions, type Mission } from '../../data/missions';
import {
  missionRewardLabel,
  missionStartBlockReason,
  nearestPendingObjective,
} from '../../game/missions';
import { useGameStore } from '../../store/gameStore';

function formatDistance(distanceMeters: number): string {
  return distanceMeters < 1_000
    ? `${Math.max(0, Math.round(distanceMeters))} m`
    : `${(distanceMeters / 1_000).toFixed(1)} km`;
}

function inactiveMissionStatus(
  mission: Mission,
  completedMissionIds: readonly string[],
  coordinates: [number, number],
): { label: string; canStart: boolean } {
  const reason = missionStartBlockReason(
    mission,
    completedMissionIds,
    coordinates,
  );
  if (reason === 'completed') return { label: 'Completada', canStart: false };
  if (reason === 'prerequisite') {
    const prerequisite = missionById.get(mission.prerequisites[0]);
    return {
      label: `Requiere: ${prerequisite?.title ?? 'misión anterior'}`,
      canStart: false,
    };
  }
  if (reason === 'wrong-location') {
    return {
      label: `Inicia en ${locationById.get(mission.startLocationId)?.name ?? 'otro lugar'}`,
      canStart: false,
    };
  }
  return { label: 'Disponible', canStart: true };
}

export function MissionPanel() {
  const [collapsed, setCollapsed] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia(
          '(max-width: 600px), (max-height: 560px) and (pointer: coarse)',
        ).matches,
  );
  const telemetry = useGameStore((state) => state.telemetry);
  const activeMissionId = useGameStore((state) => state.activeMissionId);
  const completedObjectiveIds = useGameStore(
    (state) => state.activeMissionCompletedObjectiveIds,
  );
  const completedMissionIds = useGameStore(
    (state) => state.completedMissionIds,
  );
  const startMission = useGameStore((state) => state.startMission);
  const abandonMission = useGameStore((state) => state.abandonMission);
  const active = activeMissionId ? missionById.get(activeMissionId) : null;
  const coordinates: [number, number] = [
    telemetry.longitude,
    telemetry.latitude,
  ];
  const next = active
    ? nearestPendingObjective(active, completedObjectiveIds, coordinates)
    : null;

  useEffect(() => {
    const compactQuery = window.matchMedia(
      '(max-width: 600px), (max-height: 560px) and (pointer: coarse)',
    );
    let portrait = window.innerHeight >= window.innerWidth;
    const handleCompactChange = (event: MediaQueryListEvent) => {
      setCollapsed(event.matches);
    };
    const handleResize = () => {
      const nextPortrait = window.innerHeight >= window.innerWidth;
      if (nextPortrait !== portrait && compactQuery.matches) {
        setCollapsed(true);
      }
      portrait = nextPortrait;
    };
    compactQuery.addEventListener('change', handleCompactChange);
    window.addEventListener('resize', handleResize);
    return () => {
      compactQuery.removeEventListener('change', handleCompactChange);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <aside
      className={`mission-panel ${collapsed ? 'mission-panel--collapsed' : ''}`}
      aria-label="Panel de misiones"
    >
      <header className="mission-panel__header">
        <div>
          <span className="mission-panel__eyebrow">Bitácora de campo</span>
          <h2>{active?.title ?? 'Misiones'}</h2>
        </div>
        <button
          type="button"
          aria-label={
            collapsed
              ? 'Expandir panel de misiones'
              : 'Contraer panel de misiones'
          }
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span aria-hidden="true">{collapsed ? '＋' : '−'}</span>
        </button>
      </header>

      {!collapsed && active && (
        <div className="mission-panel__body">
          <span className="mission-active-status">
            <span aria-hidden="true" /> Estado: en curso
          </span>
          <p className="mission-panel__description">{active.description}</p>

          <div
            className={`mission-route-summary ${next && next.distanceMeters <= next.objective.radiusMeters * 1.5 ? 'mission-route-summary--near' : ''}`}
          >
            <span>
              {next && next.distanceMeters <= next.objective.radiusMeters * 1.5
                ? 'Objetivo cercano'
                : 'Destino'}
            </span>
            <strong>
              {locationById.get(active.destinationLocationId)?.name}
            </strong>
            <small>
              {next
                ? `${formatDistance(next.distanceMeters)} restantes`
                : 'Objetivos registrados'}
            </small>
          </div>

          <section
            className="mission-objectives"
            aria-label="Objetivos de la misión"
          >
            <span className="mission-section-label">Objetivos</span>
            <ul>
              {active.objectives.map((objective) => {
                const completed = completedObjectiveIds.includes(objective.id);
                return (
                  <li
                    key={objective.id}
                    className={completed ? 'is-completed' : ''}
                  >
                    <span aria-hidden="true">{completed ? '✓' : '○'}</span>
                    {objective.label}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mission-rewards" aria-label="Recompensas">
            <span className="mission-section-label">Recompensa</span>
            <div>
              {active.rewards.map((reward, index) => (
                <span key={`${reward.type}-${index}`}>
                  {missionRewardLabel(reward)}
                </span>
              ))}
            </div>
          </section>

          {next?.objective.type === 'interact' &&
            next.distanceMeters <= next.objective.radiusMeters && (
              <p className="mission-interaction-hint" role="status">
                Presiona <kbd>Espacio</kbd> o Investigar para registrar la
                señal.
              </p>
            )}

          <button
            type="button"
            className="mission-button mission-button--secondary"
            onClick={abandonMission}
          >
            Abandonar misión
          </button>
        </div>
      )}

      {!collapsed && !active && (
        <div className="mission-panel__body mission-list">
          {missions.map((mission) => {
            const status = inactiveMissionStatus(
              mission,
              completedMissionIds,
              coordinates,
            );
            const isCompleted = completedMissionIds.includes(mission.id);
            return (
              <article
                key={mission.id}
                className={`mission-list__item ${isCompleted ? 'is-completed' : ''}`}
              >
                <div>
                  <span>{status.label}</span>
                  <h3>{mission.title}</h3>
                  <small>
                    {locationById.get(mission.startLocationId)?.name} →{' '}
                    {locationById.get(mission.destinationLocationId)?.name}
                  </small>
                </div>
                {!isCompleted && (
                  <button
                    type="button"
                    className="mission-button"
                    disabled={!status.canStart}
                    onClick={() => startMission(mission.id)}
                  >
                    Iniciar
                  </button>
                )}
                {isCompleted && (
                  <span className="mission-list__check" aria-label="Completada">
                    ✓
                  </span>
                )}
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}

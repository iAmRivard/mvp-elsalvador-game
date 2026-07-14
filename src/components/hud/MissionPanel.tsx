import { useEffect, useState } from 'react';
import { locationById } from '../../data/locations';
import { missionById, missions, type Mission } from '../../data/missions';
import {
  missionRewardLabel,
  missionStartBlockReason,
  nearestPendingObjective,
} from '../../game/missions';
import { formatNavigationInstruction } from '../../map/navigationInstructions';
import { useGameStore } from '../../store/gameStore';
import type { NavigationInstructionType } from '../../types/navigation';

function formatDistance(distanceMeters: number): string {
  return distanceMeters < 1_000
    ? `${Math.max(0, Math.round(distanceMeters))} m`
    : `${(distanceMeters / 1_000).toFixed(1)} km`;
}

const actionableObjectiveTypes = new Set([
  'interact',
  'collect',
  'deliver',
  'repair',
  'refuel',
  'choice',
]);

function maneuverSymbol(type: NavigationInstructionType): string {
  switch (type) {
    case 'turn-left':
      return '←';
    case 'turn-right':
      return '→';
    case 'slight-left':
      return '↖';
    case 'slight-right':
      return '↗';
    case 'u-turn':
      return '↶';
    case 'arrive':
      return '◎';
    case 'continue':
      return '↑';
  }
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
  const objectiveProgress = useGameStore(
    (state) => state.activeMissionObjectiveProgress,
  );
  const startMission = useGameStore((state) => state.startMission);
  const abandonMission = useGameStore((state) => state.abandonMission);
  const missionRoute = useGameStore((state) => state.missionRoute);
  const requestRouteRecalculation = useGameStore(
    (state) => state.requestMissionRouteRecalculation,
  );
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
            data-route-status={missionRoute.status}
          >
            <div className="mission-route-summary__header">
              <span>
                {missionRoute.offRoute
                  ? 'Has salido de la ruta'
                  : next &&
                      next.distanceMeters <= next.objective.radiusMeters * 1.5
                    ? 'Objetivo cercano'
                    : missionRoute.status === 'fallback'
                      ? 'Ruta provisional'
                      : 'Ruta por carretera'}
              </span>
              <button
                type="button"
                aria-label="Recalcular ruta"
                title="Recalcular ruta"
                disabled={missionRoute.status === 'calculating'}
                onClick={requestRouteRecalculation}
              >
                <span aria-hidden="true">↻</span>
              </button>
            </div>
            {missionRoute.nextInstruction &&
              missionRoute.distanceToNextInstructionMeters !== null &&
              missionRoute.status !== 'calculating' && (
                <div
                  className="mission-navigation-next"
                  data-navigation-type={missionRoute.nextInstruction.type}
                >
                  <span aria-hidden="true">
                    {maneuverSymbol(missionRoute.nextInstruction.type)}
                  </span>
                  <div>
                    <small>Próxima maniobra</small>
                    <strong>
                      {formatNavigationInstruction(
                        missionRoute.nextInstruction,
                        missionRoute.distanceToNextInstructionMeters,
                      )}
                    </strong>
                  </div>
                </div>
              )}
            <strong>
              {locationById.get(active.destinationLocationId)?.name}
            </strong>
            <small>
              {missionRoute.status === 'calculating'
                ? missionRoute.offRoute
                  ? 'Calculando ruta…'
                  : 'Calculando…'
                : missionRoute.distanceMeters !== null
                  ? `${formatDistance(missionRoute.distanceMeters)} · ${Math.max(1, Math.round((missionRoute.estimatedGameDurationSeconds ?? 0) / 60))} min`
                  : next
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
                const progress = objectiveProgress[objective.id];
                const showProgress =
                  !completed &&
                  progress &&
                  (objective.type === 'timed' || progress.target > 1);
                return (
                  <li
                    key={objective.id}
                    className={completed ? 'is-completed' : ''}
                  >
                    <span
                      className="mission-objective__marker"
                      aria-hidden="true"
                    >
                      {completed ? '✓' : '○'}
                    </span>
                    <span className="mission-objective__content">
                      {objective.label}
                      {showProgress && (
                        <small>
                          {objective.type === 'timed'
                            ? `${Math.max(0, Math.ceil((progress.durationSeconds ?? progress.target) - progress.elapsedSeconds))} s`
                            : `${Math.floor(progress.value)} / ${progress.target}`}
                        </small>
                      )}
                    </span>
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

          {next &&
            actionableObjectiveTypes.has(next.objective.type) &&
            next.distanceMeters <= next.objective.radiusMeters && (
              <p className="mission-interaction-hint" role="status">
                Presiona <kbd>Espacio</kbd> o el botón de acción para continuar.
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

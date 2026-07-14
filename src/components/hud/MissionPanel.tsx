import { useEffect, useState } from 'react';
import { chapterOneMissionIds } from '../../data/chapter1';
import { locationById } from '../../data/locations';
import { missionById, missions, type Mission } from '../../data/missions';
import {
  estimateFuelAtDestination,
  estimateFuelRange,
  fuelSufficiency,
} from '../../game/fuel';
import { interactionLabelForObjective } from '../../game/interactions';
import { selectedMissionChoiceOption } from '../../game/missionChoices';
import {
  getRecommendedMission,
  missionBlockExplanation,
} from '../../game/missionRecommendations';
import {
  missionRewardLabel,
  nearestPendingObjective,
} from '../../game/missions';
import { formatNavigationInstruction } from '../../map/navigationInstructions';
import { useGameStore, type StoryLogSection } from '../../store/gameStore';
import type { NavigationInstructionType } from '../../types/navigation';
import type { StoryLogEntry } from '../../types/progression';

function formatDistance(distanceMeters: number): string {
  return distanceMeters < 1_000
    ? `${Math.max(0, Math.round(distanceMeters))} m`
    : `${(distanceMeters / 1_000).toFixed(1)} km`;
}

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

const tabLabels: Readonly<Record<StoryLogSection, string>> = {
  history: 'Historia',
  missions: 'Misiones',
  transmissions: 'Radio',
  discoveries: 'Lugares',
};

function entriesForSection(
  entries: readonly StoryLogEntry[],
  section: StoryLogSection,
): StoryLogEntry[] {
  if (section === 'history') return [...entries].reverse();
  const type =
    section === 'missions'
      ? 'mission'
      : section === 'transmissions'
        ? 'radio'
        : 'discovery';
  return entries.filter((entry) => entry.type === type).reverse();
}

function StoryLog({
  entries,
  section,
}: {
  entries: readonly StoryLogEntry[];
  section: StoryLogSection;
}) {
  const filtered = entriesForSection(entries, section);
  return (
    <section className="story-log" aria-label={tabLabels[section]}>
      {filtered.length === 0 ? (
        <p className="story-log__empty">
          Los registros aparecerán aquí durante la expedición.
        </p>
      ) : (
        <ol>
          {filtered.map((entry) => (
            <li key={entry.id}>
              <span>{entry.recordedAt}</span>
              <strong>{entry.title}</strong>
              <p>{entry.summary}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MissionStartCard({
  mission,
  canStartNow,
  distanceToStartMeters,
  onStart,
  onNavigate,
}: {
  mission: Mission;
  canStartNow: boolean;
  distanceToStartMeters: number;
  onStart: () => void;
  onNavigate: () => void;
}) {
  const start = locationById.get(mission.startLocationId);
  return (
    <article className="mission-next mission-list__item">
      <span className="mission-next__label">Siguiente misión</span>
      <h3>{mission.title}</h3>
      <p>{mission.description}</p>
      <div className="mission-next__start">
        <span>{start?.name ?? 'Punto de inicio'}</span>
        <small>
          {canStartNow
            ? 'Estás en el punto de inicio'
            : `${formatDistance(distanceToStartMeters)} hasta el inicio`}
        </small>
      </div>
      <button
        type="button"
        className="mission-button mission-button--primary"
        onClick={canStartNow ? onStart : onNavigate}
      >
        {canStartNow
          ? `Iniciar ${mission.title}`
          : `Ir al inicio de ${mission.title}`}
      </button>
    </article>
  );
}

export function MissionPanel() {
  const [collapsed, setCollapsed] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia(
          '(max-width: 600px), (max-height: 560px) and (pointer: coarse)',
        ).matches,
  );
  const [section, setSection] = useState<StoryLogSection>(
    () => useGameStore.getState().storyLogRequest.section,
  );
  const telemetry = useGameStore((state) => state.telemetry);
  const driving = useGameStore((state) => state.driving);
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
  const missionChoiceSelections = useGameStore(
    (state) => state.missionChoiceSelections,
  );
  const storyLogEntries = useGameStore((state) => state.storyLogEntries);
  const startMission = useGameStore((state) => state.startMission);
  const abandonMission = useGameStore((state) => state.abandonMission);
  const retryFromCheckpoint = useGameStore(
    (state) => state.retryFromCheckpoint,
  );
  const advanceActiveMission = useGameStore(
    (state) => state.advanceActiveMission,
  );
  const missionRoute = useGameStore((state) => state.missionRoute);
  const requestRouteRecalculation = useGameStore(
    (state) => state.requestMissionRouteRecalculation,
  );
  const dismissDiscovery = useGameStore((state) => state.dismissDiscovery);
  const active = activeMissionId ? missionById.get(activeMissionId) : null;
  const coordinates: [number, number] = [
    telemetry.longitude,
    telemetry.latitude,
  ];
  const recommendation = getRecommendedMission(
    completedMissionIds,
    activeMissionId,
    coordinates,
  );
  const recommendedMission =
    recommendation && recommendation.reason !== 'resume'
      ? missionById.get(recommendation.missionId)
      : null;
  const next = active
    ? nearestPendingObjective(active, completedObjectiveIds, coordinates)
    : null;
  const selectedChoice = selectedMissionChoiceOption(
    activeMissionId,
    missionChoiceSelections,
  );
  const fuelAtDestination =
    missionRoute.distanceMeters === null
      ? null
      : estimateFuelAtDestination(missionRoute.distanceMeters, telemetry.fuel, {
          fuelMultiplier: selectedChoice?.fuelMultiplier ?? 1,
        });
  const rangeMeters = estimateFuelRange(telemetry.fuel, driving.surface);
  const optionalMissions = missions.filter(
    (mission) => mission.optional && !completedMissionIds.includes(mission.id),
  );
  const lockedMissions = missions.filter(
    (mission) =>
      !mission.optional &&
      !completedMissionIds.includes(mission.id) &&
      mission.id !== recommendedMission?.id &&
      missionBlockExplanation(mission, completedMissionIds, coordinates) !==
        null,
  );
  const completedMissions = missions.filter((mission) =>
    completedMissionIds.includes(mission.id),
  );
  useEffect(
    () =>
      useGameStore.subscribe((state, previousState) => {
        if (
          state.storyLogRequest.revision ===
          previousState.storyLogRequest.revision
        ) {
          return;
        }
        setSection(state.storyLogRequest.section);
        setCollapsed(false);
      }),
    [],
  );

  useEffect(() => {
    const compactQuery = window.matchMedia(
      '(max-width: 600px), (max-height: 560px) and (pointer: coarse)',
    );
    const handleCompactChange = (event: MediaQueryListEvent) => {
      setCollapsed(event.matches);
    };
    compactQuery.addEventListener('change', handleCompactChange);
    return () =>
      compactQuery.removeEventListener('change', handleCompactChange);
  }, []);

  return (
    <aside
      className={`mission-panel ${collapsed ? 'mission-panel--collapsed' : ''}`}
      aria-label="Panel de misiones"
    >
      <header className="mission-panel__header">
        <div>
          <span className="mission-panel__eyebrow">Bitácora de campo</span>
          <h2>{active?.title ?? recommendedMission?.title ?? 'Historia'}</h2>
        </div>
        <button
          type="button"
          aria-label={
            collapsed
              ? 'Expandir panel de misiones'
              : 'Contraer panel de misiones'
          }
          aria-expanded={!collapsed}
          onClick={() => {
            if (collapsed) dismissDiscovery();
            setCollapsed((value) => !value);
          }}
        >
          <span aria-hidden="true">{collapsed ? '＋' : '−'}</span>
        </button>
      </header>

      {collapsed && recommendedMission && recommendation && (
        <button
          type="button"
          className="mission-panel__collapsed-cta"
          onClick={
            recommendation.canStartNow
              ? () => startMission(recommendedMission.id)
              : requestRouteRecalculation
          }
        >
          <span>Siguiente misión</span>
          <strong>
            {recommendation.canStartNow
              ? `Iniciar ${recommendedMission.title}`
              : `Ir al inicio de ${recommendedMission.title}`}
          </strong>
        </button>
      )}

      {!collapsed && (
        <>
          <nav className="mission-tabs" aria-label="Secciones de bitácora">
            {(Object.keys(tabLabels) as StoryLogSection[]).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={section === tab}
                onClick={() => setSection(tab)}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </nav>

          {section !== 'missions' ? (
            <div className="mission-panel__body">
              <StoryLog entries={storyLogEntries} section={section} />
            </div>
          ) : active ? (
            <div className="mission-panel__body">
              <span className="mission-active-status">
                <span aria-hidden="true" /> Estado: en curso
              </span>
              <p className="mission-panel__description">{active.description}</p>

              <div
                className={`mission-route-summary ${missionRoute.offRoute ? 'mission-route-summary--off-route' : ''}`}
                data-route-status={missionRoute.status}
              >
                <div className="mission-route-summary__header">
                  <span>
                    {missionRoute.offRoute
                      ? 'Te alejaste de la ruta'
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
                  missionRoute.distanceToNextInstructionMeters !== null && (
                    <div className="mission-navigation-next">
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
                  {next?.objective.label ?? 'Objetivo registrado'}
                </strong>
                <small>
                  {missionRoute.status === 'calculating'
                    ? 'Calculando…'
                    : missionRoute.distanceMeters !== null
                      ? formatDistance(missionRoute.distanceMeters)
                      : next
                        ? formatDistance(next.distanceMeters)
                        : 'Ruta completada'}
                </small>
              </div>

              <div className="mission-fuel-estimate">
                <span>Autonomía aprox. {formatDistance(rangeMeters)}</span>
                {fuelAtDestination !== null && (
                  <strong data-fuel-status={fuelSufficiency(fuelAtDestination)}>
                    Destino: {fuelAtDestination.toFixed(0)}% ·{' '}
                    {fuelSufficiency(fuelAtDestination) === 'sufficient'
                      ? 'Suficiente'
                      : fuelSufficiency(fuelAtDestination) === 'tight'
                        ? 'Justo'
                        : 'Combustible insuficiente'}
                  </strong>
                )}
                {fuelAtDestination !== null &&
                  fuelSufficiency(fuelAtDestination) === 'insufficient' && (
                    <button type="button" onClick={retryFromCheckpoint}>
                      Volver al checkpoint
                    </button>
                  )}
              </div>

              <section className="mission-objectives" aria-label="Objetivos">
                <span className="mission-section-label">Objetivos</span>
                <ul>
                  {active.objectives.map((objective) => {
                    const completed = completedObjectiveIds.includes(
                      objective.id,
                    );
                    const progress = objectiveProgress[objective.id];
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
                          {!completed && progress?.selectedOptionId && (
                            <small>Ruta guardada</small>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {next &&
                ['interact', 'deliver', 'repair', 'refuel', 'choice'].includes(
                  next.objective.type,
                ) &&
                next.distanceMeters <= next.objective.radiusMeters && (
                  <button
                    type="button"
                    className="mission-context-action"
                    onClick={() => advanceActiveMission(telemetry, true, 0)}
                  >
                    <kbd>E</kbd>
                    <span>{interactionLabelForObjective(next.objective)}</span>
                  </button>
                )}

              <section className="mission-rewards" aria-label="Recompensas">
                <span className="mission-section-label">Recompensa</span>
                <div>
                  {active.rewards.map((reward, index) => (
                    <span key={`${reward.type}-${String(index)}`}>
                      {missionRewardLabel(reward)}
                    </span>
                  ))}
                </div>
              </section>
              <button
                type="button"
                className="mission-button mission-button--secondary"
                onClick={abandonMission}
              >
                Abandonar misión
              </button>
            </div>
          ) : (
            <div className="mission-panel__body mission-list">
              {recommendedMission && recommendation && (
                <MissionStartCard
                  mission={recommendedMission}
                  canStartNow={recommendation.canStartNow}
                  distanceToStartMeters={recommendation.distanceToStartMeters}
                  onStart={() => startMission(recommendedMission.id)}
                  onNavigate={requestRouteRecalculation}
                />
              )}

              {optionalMissions
                .filter((mission) => mission.id !== recommendedMission?.id)
                .map((mission) => {
                  const explanation = missionBlockExplanation(
                    mission,
                    completedMissionIds,
                    coordinates,
                  );
                  return (
                    <article
                      key={mission.id}
                      className="mission-optional mission-list__item"
                    >
                      <span>Misión opcional disponible</span>
                      <h3>{mission.title}</h3>
                      <p>{mission.description}</p>
                      <small>{explanation ?? 'Disponible aquí'}</small>
                      {!explanation && (
                        <button
                          type="button"
                          className="mission-button"
                          onClick={() => startMission(mission.id)}
                        >
                          Iniciar opcional
                        </button>
                      )}
                    </article>
                  );
                })}

              {lockedMissions.length > 0 && (
                <details className="mission-group">
                  <summary>
                    Próximas misiones · {lockedMissions.length} bloqueadas
                  </summary>
                  <div>
                    {lockedMissions.map((mission) => (
                      <article key={mission.id} className="mission-locked">
                        <h3>{mission.title}</h3>
                        <p>
                          {missionBlockExplanation(
                            mission,
                            completedMissionIds,
                            coordinates,
                          )}
                        </p>
                      </article>
                    ))}
                  </div>
                </details>
              )}

              {completedMissions.length > 0 && (
                <details className="mission-group mission-group--completed">
                  <summary>
                    Completadas · {completedMissions.length}/
                    {chapterOneMissionIds.length}
                  </summary>
                  <div>
                    {completedMissions.map((mission) => (
                      <article key={mission.id} className="mission-completed">
                        <span aria-hidden="true">✓</span>
                        <h3>{mission.title}</h3>
                      </article>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

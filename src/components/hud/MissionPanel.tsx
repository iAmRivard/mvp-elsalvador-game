import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { chapterOneMissionIds } from '../../data/chapter1';
import { locationById } from '../../data/locations';
import { missionById, missions, type Mission } from '../../data/missions';
import {
  estimateFuelAtDestination,
  estimateFuelRange,
  fuelSufficiency,
} from '../../game/fuel';
import {
  interactionLabelForObjective,
  objectiveRequiresManualInteraction,
} from '../../game/interactions';
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
import {
  navigationGuidanceMessage,
  vehicleIsReversing,
} from '../../map/navigationGuidance';
import { useGameStore, type StoryLogSection } from '../../store/gameStore';
import type { NavigationInstructionType } from '../../types/navigation';
import { onboardingIsActive } from '../../types/onboarding';
import type { StoryLogEntry } from '../../types/progression';

const compactViewportQuery =
  '(max-width: 600px), (max-width: 900px) and (pointer: coarse), (max-height: 560px) and (pointer: coarse)';

export type MobileJournalSheetState =
  'closed' | 'compact' | 'half' | 'expanded';

function isCompactViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia(compactViewportQuery).matches
  );
}

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
  const panelRef = useRef<HTMLElement>(null);
  const panelCommitCount = useRef(0);
  const sheetCommitCount = useRef(0);
  const [compactViewport, setCompactViewport] = useState(isCompactViewport);
  const [collapsed, setCollapsed] = useState(
    () => !useGameStore.getState().isJournalOpen,
  );
  const [sheetState, setSheetState] = useState<MobileJournalSheetState>(() => {
    if (useGameStore.getState().isJournalOpen) return 'half';
    return isCompactViewport() ? 'compact' : 'closed';
  });
  const autoCollapseAt = useRef<number | null>(null);
  const sheetDrag = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    startState: MobileJournalSheetState;
  } | null>(null);
  const suppressSheetHandleClick = useRef(false);
  const [section, setSection] = useState<StoryLogSection>(
    () => useGameStore.getState().journalSection,
  );
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);
  const openJournalStore = useGameStore((state) => state.openJournal);
  const closeJournalStore = useGameStore((state) => state.closeJournal);
  const onboardingState = useGameStore((state) => state.onboardingState);
  const telemetry = useGameStore((state) => state.telemetry);
  const presentationMode = useGameStore((state) => state.presentationMode);
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
  const recommendation = activeMissionId
    ? null
    : getRecommendedMission(completedMissionIds, activeMissionId, coordinates);
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
    collapsed || missionRoute.distanceMeters === null
      ? null
      : estimateFuelAtDestination(missionRoute.distanceMeters, telemetry.fuel, {
          fuelMultiplier: selectedChoice?.fuelMultiplier ?? 1,
        });
  const rangeMeters = collapsed
    ? 0
    : estimateFuelRange(telemetry.fuel, driving.surface);
  const reversing = vehicleIsReversing(telemetry.speedMetersPerSecond);
  const navigationGuidance = navigationGuidanceMessage(
    missionRoute.activeNavigation,
    missionRoute.orientation,
    telemetry.speedKilometersPerHour,
    driving.roadDistanceMeters,
    reversing,
  );
  const optionalMissions =
    !collapsed && !active
      ? missions.filter(
          (mission) =>
            mission.optional && !completedMissionIds.includes(mission.id),
        )
      : [];
  const lockedMissions =
    !collapsed && !active
      ? missions.filter(
          (mission) =>
            !mission.optional &&
            !completedMissionIds.includes(mission.id) &&
            mission.id !== recommendedMission?.id &&
            missionBlockExplanation(
              mission,
              completedMissionIds,
              coordinates,
            ) !== null,
        )
      : [];
  const completedMissions =
    !collapsed && !active
      ? missions.filter((mission) => completedMissionIds.includes(mission.id))
      : [];
  const compactMission = active ?? recommendedMission;
  const miniNavigationText = reversing
    ? 'Reversa · guía pausada'
    : (navigationGuidance ??
      (missionRoute.nextInstruction &&
      missionRoute.distanceToNextInstructionMeters !== null
        ? formatNavigationInstruction(
            missionRoute.nextInstruction,
            missionRoute.distanceToNextInstructionMeters,
          )
        : 'Sigue la ruta hacia el objetivo'));
  const miniNavigationDistance =
    missionRoute.distanceMeters ?? next?.distanceMeters ?? null;
  const contextActionLabel =
    next &&
    objectiveRequiresManualInteraction(next.objective) &&
    next.distanceMeters <= next.objective.radiusMeters
      ? interactionLabelForObjective(next.objective)
      : null;
  const onboardingActive = onboardingIsActive(onboardingState);

  useEffect(() => {
    panelCommitCount.current += 1;
    if (compactViewport && !collapsed) sheetCommitCount.current += 1;
    if (panelRef.current) {
      panelRef.current.dataset.renderCount = String(panelCommitCount.current);
      panelRef.current.dataset.sheetRenderCount = String(
        sheetCommitCount.current,
      );
    }
  });

  useEffect(
    () =>
      useGameStore.subscribe((state, previousState) => {
        if (
          state.isJournalOpen === previousState.isJournalOpen &&
          state.journalSection === previousState.journalSection
        ) {
          return;
        }
        setSection(state.journalSection);
        if (state.isJournalOpen) {
          setSheetState('half');
          setCollapsed(false);
        } else {
          setSheetState(compactViewport ? 'compact' : 'closed');
          setCollapsed(true);
        }
      }),
    [compactViewport],
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
        autoCollapseAt.current = null;
      }),
    [],
  );

  useEffect(() => {
    const compactQuery = window.matchMedia(compactViewportQuery);
    const handleCompactChange = (event: MediaQueryListEvent) => {
      setCompactViewport(event.matches);
      const journalOpen = useGameStore.getState().isJournalOpen;
      setSheetState(
        journalOpen ? 'half' : event.matches ? 'compact' : 'closed',
      );
      setCollapsed(!journalOpen);
    };
    compactQuery.addEventListener('change', handleCompactChange);
    return () =>
      compactQuery.removeEventListener('change', handleCompactChange);
  }, []);

  useEffect(
    () =>
      useGameStore.subscribe((state, previousState) => {
        if (
          !compactViewport ||
          state.activeMissionId === previousState.activeMissionId
        ) {
          return;
        }
        if (state.activeMissionId) {
          if (onboardingIsActive(state.onboardingState)) {
            state.closeJournal();
            autoCollapseAt.current = null;
          } else {
            state.openJournal('missions');
            autoCollapseAt.current = performance.now() + 2_500;
          }
        } else {
          autoCollapseAt.current = null;
          state.closeJournal();
        }
      }),
    [compactViewport],
  );

  useEffect(() => {
    if (
      !compactViewport ||
      (presentationMode !== 'driving' && presentationMode !== 'fast')
    ) {
      return;
    }
    autoCollapseAt.current = null;
    const timer = window.setTimeout(() => {
      closeJournalStore();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [closeJournalStore, compactViewport, presentationMode]);

  useEffect(
    () =>
      useGameStore.subscribe((state) => {
        if (
          !compactViewport ||
          !state.activeMissionId ||
          autoCollapseAt.current === null ||
          performance.now() < autoCollapseAt.current ||
          Math.abs(state.telemetry.speedKilometersPerHour) <= 5
        ) {
          return;
        }
        autoCollapseAt.current = null;
        state.closeJournal();
      }),
    [compactViewport],
  );

  const openJournal = (requestedSection: StoryLogSection = 'missions') => {
    dismissDiscovery();
    autoCollapseAt.current = null;
    openJournalStore(requestedSection);
  };
  const closeJournal = () => {
    autoCollapseAt.current = null;
    closeJournalStore();
  };
  const beginSheetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!compactViewport || collapsed) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetDrag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      startState: sheetState,
    };
  };
  const moveSheetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (sheetDrag.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    sheetDrag.current.lastY = event.clientY;
  };
  const finishSheetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = sheetDrag.current;
    if (drag?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const deltaY = drag.lastY - drag.startY;
    sheetDrag.current = null;
    if (Math.abs(deltaY) < 36) return;
    suppressSheetHandleClick.current = true;
    if (deltaY < 0) {
      setSheetState('expanded');
      setCollapsed(false);
    } else if (drag.startState === 'expanded') {
      setSheetState('half');
    } else {
      closeJournal();
    }
  };

  return (
    <aside
      ref={panelRef}
      className={`mission-panel ${collapsed ? 'mission-panel--collapsed' : ''} ${compactViewport && !collapsed ? `mission-panel--journal-sheet mission-panel--sheet-${sheetState}` : ''}`}
      aria-label="Panel de misiones"
      data-mobile-sheet-state={compactViewport ? sheetState : 'closed'}
      data-journal-open={isJournalOpen}
      data-context-action={contextActionLabel ?? undefined}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      {compactViewport && !collapsed && (
        <button
          type="button"
          className="mission-panel__drag-handle"
          aria-label={
            sheetState === 'expanded'
              ? 'Contraer bitácora'
              : 'Expandir bitácora'
          }
          onClick={() => {
            if (suppressSheetHandleClick.current) {
              suppressSheetHandleClick.current = false;
              return;
            }
            setSheetState((current) =>
              current === 'expanded' ? 'half' : 'expanded',
            );
          }}
          onPointerDown={beginSheetDrag}
          onPointerMove={moveSheetDrag}
          onPointerUp={finishSheetDrag}
          onPointerCancel={finishSheetDrag}
        >
          <span aria-hidden="true" />
        </button>
      )}
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
              : compactViewport
                ? 'Cerrar bitácora'
                : 'Contraer panel de misiones'
          }
          aria-expanded={!collapsed}
          onClick={() => {
            if (collapsed) {
              openJournal();
            } else {
              closeJournal();
            }
          }}
        >
          <span aria-hidden="true">{collapsed ? '＋' : '−'}</span>
        </button>
      </header>

      {collapsed && active && (
        <section
          className="mobile-mini-navigator"
          aria-label="Navegación de misión activa"
          data-reversing={reversing}
          data-testid="mobile-mini-navigator"
        >
          <button
            type="button"
            aria-label={`Ver objetivo de ${active.title}`}
            onClick={() => openJournal()}
          >
            <span
              className="mobile-mini-navigator__maneuver"
              aria-hidden="true"
            >
              {reversing
                ? '↓'
                : maneuverSymbol(
                    missionRoute.activeNavigation?.maneuverType ??
                      missionRoute.nextInstruction?.type ??
                      'continue',
                  )}
            </span>
            <span className="mobile-mini-navigator__copy">
              <strong>{miniNavigationText}</strong>
              <span>{next?.objective.label ?? 'Objetivo registrado'}</span>
              <small>
                {active.title}
                {miniNavigationDistance === null
                  ? ''
                  : ` · ${formatDistance(miniNavigationDistance)}`}
              </small>
            </span>
            <span className="mobile-mini-navigator__action">Ver objetivo</span>
          </button>
        </section>
      )}

      {collapsed && !active && compactMission && !onboardingActive && (
        <section
          className="mission-panel__collapsed-cta"
          aria-label="Siguiente misión"
          data-testid="mobile-mission-cta"
        >
          <span>Siguiente misión</span>
          <strong>{compactMission.title}</strong>
          <p>{compactMission.description}</p>
          <div>
            <button
              type="button"
              className="mission-button mission-button--primary"
              onClick={() => {
                if (recommendedMission && recommendation?.canStartNow) {
                  startMission(recommendedMission.id);
                } else {
                  requestRouteRecalculation();
                }
              }}
            >
              {recommendation?.canStartNow ? 'Iniciar misión' : 'Ir al inicio'}
            </button>
            <button
              type="button"
              className="mission-panel__details-button"
              onClick={() => openJournal()}
            >
              Ver detalles
            </button>
          </div>
        </section>
      )}

      {!collapsed && (
        <>
          <nav className="mission-tabs" aria-label="Secciones de bitácora">
            {(Object.keys(tabLabels) as StoryLogSection[]).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={section === tab}
                onClick={() => openJournalStore(tab)}
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
                className={`mission-route-summary ${missionRoute.offRoute || missionRoute.activeNavigation?.requiresRejoin ? 'mission-route-summary--off-route' : ''}`}
                data-route-status={missionRoute.status}
              >
                <div className="mission-route-summary__header">
                  <span>
                    {reversing
                      ? 'Guía pausada en reversa'
                      : missionRoute.status === 'fallback'
                        ? 'Ruta vial no disponible'
                        : missionRoute.activeNavigation?.requiresRejoin
                          ? 'Reincorporación'
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
                {!reversing &&
                  (navigationGuidance ||
                    (missionRoute.nextInstruction &&
                      missionRoute.distanceToNextInstructionMeters !==
                        null)) && (
                    <div className="mission-navigation-next">
                      <span aria-hidden="true">
                        {maneuverSymbol(
                          missionRoute.activeNavigation?.maneuverType ??
                            missionRoute.nextInstruction?.type ??
                            'continue',
                        )}
                      </span>
                      <div>
                        <small>
                          {missionRoute.activeNavigation?.requiresRejoin
                            ? 'Vuelve al camino'
                            : 'Próxima maniobra'}
                        </small>
                        <strong>
                          {navigationGuidance ??
                            (missionRoute.nextInstruction &&
                            missionRoute.distanceToNextInstructionMeters !==
                              null
                              ? formatNavigationInstruction(
                                  missionRoute.nextInstruction,
                                  missionRoute.distanceToNextInstructionMeters,
                                )
                              : '')}
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

              {contextActionLabel && (
                <button
                  type="button"
                  className="mission-context-action"
                  aria-label={contextActionLabel}
                  onClick={() => advanceActiveMission(telemetry, true, 0)}
                >
                  <kbd>E</kbd>
                  <span>{contextActionLabel}</span>
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

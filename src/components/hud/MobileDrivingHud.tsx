import { useEffect, useRef, useState } from 'react';
import { missionById } from '../../data/missions';
import { nearestPendingObjective } from '../../game/missions';
import { formatNavigationInstruction } from '../../map/navigationInstructions';
import { vehicleIsReversing } from '../../map/navigationGuidance';
import { useGameStore } from '../../store/gameStore';
import type { NavigationInstructionType } from '../../types/navigation';

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

function readHudSnapshot() {
  const state = useGameStore.getState();
  return {
    presentationMode: state.presentationMode,
    telemetry: state.telemetry,
    vehicleCondition: state.vehicle.condition,
    activeMissionId: state.activeMissionId,
    completedObjectiveIds: state.activeMissionCompletedObjectiveIds,
    route: state.missionRoute,
    countdown: state.missionTimerCountdownSeconds,
  };
}

function MobileDrivingHudContent() {
  const hudRef = useRef<HTMLElement>(null);
  const renderCount = useRef(0);
  const [snapshot, setSnapshot] = useState(readHudSnapshot);
  const {
    presentationMode,
    telemetry,
    vehicleCondition,
    activeMissionId,
    completedObjectiveIds,
    route,
    countdown,
  } = snapshot;
  const mission = activeMissionId ? missionById.get(activeMissionId) : null;
  const next = mission
    ? nearestPendingObjective(mission, completedObjectiveIds, [
        telemetry.longitude,
        telemetry.latitude,
      ])
    : null;
  useEffect(() => {
    renderCount.current += 1;
    if (hudRef.current) {
      hudRef.current.dataset.renderCount = String(renderCount.current);
    }
  });

  useEffect(() => {
    const interval = window.setInterval(
      () => setSnapshot(readHudSnapshot()),
      200,
    );
    return () => window.clearInterval(interval);
  }, []);

  const reversing = vehicleIsReversing(telemetry.speedMetersPerSecond);

  const instructionType =
    route.activeNavigation?.maneuverType ??
    route.nextInstruction?.type ??
    'continue';
  const instruction = reversing
    ? 'Reversa · guía pausada'
    : route.activeNavigation?.requiresRejoin
      ? 'Vuelve a la ruta'
      : route.nextInstruction && route.distanceToNextInstructionMeters !== null
        ? formatNavigationInstruction(
            route.nextInstruction,
            route.distanceToNextInstructionMeters,
          )
        : 'Sigue la ruta hacia el objetivo';
  const distance = route.distanceMeters ?? next?.distanceMeters ?? null;

  return (
    <aside
      ref={hudRef}
      className={`mobile-driving-hud mobile-driving-hud--${presentationMode}`}
      aria-label="Navegación y estado de conducción"
      data-testid="mobile-driving-hud"
      data-reversing={reversing}
    >
      <button
        type="button"
        className="mobile-driving-hud__navigation"
        aria-label="Abrir bitácora de la misión"
        onClick={() => useGameStore.getState().requestStoryLog('missions')}
      >
        <span className="mobile-driving-hud__maneuver" aria-hidden="true">
          {reversing ? '↓' : maneuverSymbol(instructionType)}
        </span>
        <span className="mobile-driving-hud__copy">
          <strong>{instruction}</strong>
          <small>
            {next?.objective.label ?? mission?.title ?? 'Objetivo registrado'}
            {distance === null ? '' : ` · ${formatDistance(distance)}`}
          </small>
        </span>
      </button>
      <div className="mobile-driving-hud__vitals">
        <strong data-testid="mobile-driving-speed">
          {Math.abs(telemetry.speedKilometersPerHour).toFixed(0)} km/h
        </strong>
        <span
          aria-label={`Combustible ${telemetry.fuel.toFixed(0)} por ciento`}
        >
          ⛽ {telemetry.fuel.toFixed(0)}%
        </span>
        <span
          aria-label={`Condición ${vehicleCondition.toFixed(0)} por ciento`}
        >
          🔧 {vehicleCondition.toFixed(0)}%
        </span>
        {countdown > 0 && <span>⏱ {Math.ceil(countdown)} s</span>}
      </div>
    </aside>
  );
}

export function MobileDrivingHud() {
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);
  const presentationMode = useGameStore((state) => state.presentationMode);
  const moving = useGameStore(
    (state) => Math.abs(state.telemetry.speedKilometersPerHour) >= 5,
  );

  if (isJournalOpen || (!moving && presentationMode === 'stopped')) {
    return null;
  }
  return <MobileDrivingHudContent />;
}

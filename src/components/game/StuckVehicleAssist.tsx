import { useEffect, useRef, useState } from 'react';
import type { InputController } from '../../game/inputController';
import type {
  RouteRejoinBlockReason,
  RouteRejoinCandidate,
} from '../../game/routeRejoin';
import {
  stuckVehicleConfig,
  stuckVehicleHelpFor,
} from '../../game/stuckVehicle';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';

interface StuckVehicleAssistProps {
  input: InputController;
  enabled: boolean;
}

interface AssistView {
  kind: 'none' | 'start-hint' | 'stuck' | 'rejoin';
  cause: string | null;
  canRetryAcceleration: boolean;
  rejoinCandidate: RouteRejoinCandidate | null;
  rejoinBlockedBy: RouteRejoinBlockReason | null;
}

const EMPTY_VIEW: AssistView = {
  kind: 'none',
  cause: null,
  canRetryAcceleration: false,
  rejoinCandidate: null,
  rejoinBlockedBy: null,
};

function sameAssistView(first: AssistView, second: AssistView): boolean {
  return (
    first.kind === second.kind &&
    first.cause === second.cause &&
    first.canRetryAcceleration === second.canRetryAcceleration &&
    first.rejoinCandidate?.edgeId === second.rejoinCandidate?.edgeId &&
    first.rejoinCandidate?.coordinates[0] ===
      second.rejoinCandidate?.coordinates[0] &&
    first.rejoinCandidate?.coordinates[1] ===
      second.rejoinCandidate?.coordinates[1] &&
    first.rejoinBlockedBy === second.rejoinBlockedBy
  );
}

const blockedMessages: Readonly<Record<string, string>> = {
  water: 'Hay agua bloqueando el avance.',
  blocked: 'Esta zona está restringida.',
  'out-of-bounds': 'Llegaste al límite del área jugable.',
};

export function StuckVehicleAssist({
  input,
  enabled,
}: StuckVehicleAssistProps) {
  const [view, setView] = useState<AssistView>(EMPTY_VIEW);
  const controlMode = useSettingsStore((state) => state.controlMode);
  const requestStartedAt = useRef<number | null>(null);
  const sessionStartedAt = useRef<number | null>(null);
  const lastDistance = useRef<number | null>(null);
  const dismissedUntil = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const now = performance.now();
      const state = useGameStore.getState();
      const diagnostics = input.getDiagnostics();
      const target = diagnostics.mobileCruise.targetSpeedKilometersPerHour;
      const forwardIntent =
        diagnostics.mobileCruiseVerticalIntent > 0.12 ||
        diagnostics.throttle > 0.12;
      const hasForwardRequest = target > 10 || forwardIntent;
      const distance = state.telemetry.totalDistanceMeters;
      requestStartedAt.current ??= now;
      sessionStartedAt.current ??= now;
      lastDistance.current ??= distance;
      if (Math.abs(distance - lastDistance.current) >= 0.25) {
        lastDistance.current = distance;
        requestStartedAt.current = now;
      } else if (!hasForwardRequest) {
        requestStartedAt.current = now;
      }
      const blockingOverlay = Boolean(
        state.isPaused ||
          state.isJournalOpen ||
          state.recoveryReason ||
          state.activeNarrativeEventId ||
          state.activeMissionChoiceObjectiveId,
      );
      const rejoinEligibility = state.getRouteRejoinEligibility();
      if (now < dismissedUntil.current) {
        setView((current) =>
          sameAssistView(current, EMPTY_VIEW) ? current : EMPTY_VIEW,
        );
        return;
      }
      const help = stuckVehicleHelpFor({
        gameActive: true,
        simulationEnabled: !blockingOverlay,
        blockingOverlay,
        fuel: state.vehicle.fuel,
        condition: state.vehicle.condition,
        speedKilometersPerHour: state.telemetry.speedKilometersPerHour,
        targetSpeedKilometersPerHour: target,
        forwardIntent,
        stationaryMilliseconds: now - requestStartedAt.current,
        movementBlockedBy: state.driving.movementBlockedBy,
      });
      if (help.visible) {
        const nextView: AssistView = {
          kind: 'stuck',
          cause: help.cause,
          canRetryAcceleration:
            help.canRetryAcceleration &&
            (controlMode === 'arcade-driving' ||
              controlMode === 'target-speed-joystick'),
          rejoinCandidate: rejoinEligibility.eligible
            ? rejoinEligibility.candidate
            : null,
          rejoinBlockedBy: rejoinEligibility.blockedBy,
        };
        setView((current) =>
          sameAssistView(current, nextView) ? current : nextView,
        );
        return;
      }
      if (rejoinEligibility.eligible) {
        const nextView: AssistView = {
          kind: 'rejoin',
          cause: null,
          canRetryAcceleration: false,
          rejoinCandidate: rejoinEligibility.candidate,
          rejoinBlockedBy: null,
        };
        setView((current) =>
          sameAssistView(current, nextView) ? current : nextView,
        );
        return;
      }
      const showStartHint =
        controlMode === 'arcade-driving' &&
        !blockingOverlay &&
        target <= 0.5 &&
        Math.abs(state.telemetry.speedKilometersPerHour) < 1 &&
        now - sessionStartedAt.current >= 1_500;
      const nextView: AssistView = showStartHint
          ? {
              kind: 'start-hint',
              cause: null,
              canRetryAcceleration: false,
              rejoinCandidate: null,
              rejoinBlockedBy: rejoinEligibility.blockedBy,
            }
          : EMPTY_VIEW;
      setView((current) =>
        sameAssistView(current, nextView) ? current : nextView,
      );
    };
    const initialUpdate = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 250);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, [controlMode, enabled, input]);

  if (!enabled || view.kind === 'none') return null;

  const close = () => {
    dismissedUntil.current = performance.now() + 10_000;
    setView(EMPTY_VIEW);
  };
  return (
    <aside
      className="stuck-vehicle-assist"
      aria-live="polite"
      data-stuck-vehicle-assist={view.kind}
      data-route-rejoin-blocked-by={view.rejoinBlockedBy ?? ''}
    >
      <div>
        <strong>
          {view.kind === 'start-hint'
            ? 'Listo para conducir'
            : view.kind === 'rejoin'
              ? 'Fuera de carretera'
            : 'Tu vehículo no está avanzando'}
        </strong>
        <span>
          {view.cause
            ? blockedMessages[view.cause]
            : view.kind === 'start-hint'
              ? 'Desliza hacia arriba para arrancar; al soltar mantendrás la marcha.'
              : view.kind === 'rejoin' && view.rejoinCandidate
                ? `Hay una vía segura a ${String(
                    Math.round(view.rejoinCandidate.distanceMeters),
                  )} m.`
              : `No hubo movimiento durante ${String(
                  stuckVehicleConfig.stationaryDelayMilliseconds / 1_000,
                )} s.`}
        </span>
      </div>
      {view.canRetryAcceleration && (
        <button type="button" onClick={() => input.retryArcadeAcceleration()}>
          Reintentar aceleración
        </button>
      )}
      {view.rejoinCandidate && (
        <button
          type="button"
          onClick={() => {
            if (
              useGameStore
                .getState()
                .rejoinPlayerToRoad(view.rejoinCandidate!.edgeId)
            ) {
              input.clearAllInput();
              input.resetMobileBoostCompletely();
              dismissedUntil.current = performance.now() + 1_200;
              setView(EMPTY_VIEW);
            }
          }}
        >
          REINCORPORAR
        </button>
      )}
      {controlMode !== 'arcade-driving' && (
        <button
          type="button"
          onClick={() =>
            useSettingsStore
              .getState()
              .setMobileControlMode('arcade-driving')
          }
        >
          Cambiar a conducción arcade
        </button>
      )}
      <button
        type="button"
        className="stuck-vehicle-assist__dismiss"
        aria-label="Cerrar ayuda de conducción"
        onClick={close}
      >
        ×
      </button>
    </aside>
  );
}

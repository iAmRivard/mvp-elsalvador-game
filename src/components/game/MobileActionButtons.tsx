import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import {
  autoThrottleConfig,
  mobileBoostConfig,
} from '../../config/mobileControls.config';
import { triggerHaptic } from '../../game/haptics';
import type { InputController } from '../../game/inputController';
import { consumeAutoThrottleHint } from '../../game/mobileControlHelp';
import { useGameStore } from '../../store/gameStore';
import { pointerActionHandlers } from './pointerControlHandlers';

interface MobileActionButtonsProps {
  input: InputController;
  interactionLabel: string | null;
  isPaused: boolean;
  onCenter: () => void;
  onTogglePause: () => void;
  autoThrottleAvailable?: boolean;
  hapticsEnabled: boolean;
  controlsDisabled?: boolean;
}

export function MobileActionButtons({
  input,
  interactionLabel,
  isPaused,
  onCenter,
  onTogglePause,
  autoThrottleAvailable = false,
  hapticsEnabled,
  controlsDisabled = false,
}: MobileActionButtonsProps) {
  const fuel = useGameStore((state) => state.telemetry.fuel);
  const condition = useGameStore((state) => state.vehicle.condition);
  const [showCruiseHint, setShowCruiseHint] = useState(false);
  const cruiseHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoThrottleStatus = useSyncExternalStore(
    (listener) => input.subscribe(listener),
    () => input.getAutoThrottleStatus(),
    () => 'off',
  );
  const mobileBoost = useSyncExternalStore(
    (listener) => input.subscribe(listener),
    () => input.getMobileBoostState(),
    () => ({
      active: false,
      remainingMilliseconds: 0,
      cooldownRemainingMilliseconds: 0,
    }),
  );
  const boostUnavailableReason =
    condition <= 0 ? 'Averiado' : fuel <= 0 ? 'Sin combustible' : null;
  const boostStatus = boostUnavailableReason
    ? 'unavailable'
    : mobileBoost.active
      ? 'active'
      : mobileBoost.cooldownRemainingMilliseconds > 0
        ? 'cooldown'
        : 'available';
  const boostRemaining = mobileBoost.active
    ? mobileBoost.remainingMilliseconds
    : mobileBoost.cooldownRemainingMilliseconds;
  const boostProgress = mobileBoost.active
    ? mobileBoost.remainingMilliseconds / mobileBoostConfig.durationMilliseconds
    : boostStatus === 'cooldown'
      ? 1 -
        mobileBoost.cooldownRemainingMilliseconds /
          mobileBoostConfig.cooldownMilliseconds
      : 0;

  useEffect(
    () => () => {
      if (cruiseHintTimer.current) clearTimeout(cruiseHintTimer.current);
    },
    [],
  );

  return (
    <div className="mobile-actions">
      <div className="touch-utilities">
        <button
          type="button"
          className="touch-button touch-button--utility"
          aria-label="Centrar cámara en el jugador"
          onClick={onCenter}
        >
          <span aria-hidden="true">⌖</span>
        </button>
        <button
          type="button"
          className={`touch-button touch-button--utility ${isPaused ? 'touch-button--active' : ''}`}
          aria-label={isPaused ? 'Reanudar partida' : 'Pausar partida'}
          onClick={onTogglePause}
        >
          <span aria-hidden="true">{isPaused ? '▶' : 'Ⅱ'}</span>
        </button>
      </div>
      <div className="touch-primary-actions">
        {interactionLabel && (
          <button
            type="button"
            className="touch-button touch-button--interact"
            aria-label={interactionLabel}
            disabled={controlsDisabled}
            {...pointerActionHandlers(
              input,
              'interact',
              250,
              controlsDisabled,
              () => triggerHaptic('button', hapticsEnabled),
            )}
          >
            <span aria-hidden="true">✦</span>
            <small>{interactionLabel}</small>
          </button>
        )}
        <button
          type="button"
          className={`touch-button touch-button--boost touch-button--boost-${boostStatus}`}
          aria-label="Turbo"
          aria-describedby="mobile-boost-status"
          disabled={controlsDisabled || boostStatus === 'unavailable'}
          style={
            {
              '--boost-progress': Math.max(0, Math.min(1, boostProgress)),
            } as CSSProperties
          }
          onClick={() => {
            if (controlsDisabled) return;
            if (input.activateMobileBoost({ fuel, condition })) {
              triggerHaptic('boost', hapticsEnabled);
            }
          }}
        >
          <strong>TURBO</strong>
          <small id="mobile-boost-status">
            {boostRemaining > 0
              ? `${(boostRemaining / 1_000).toFixed(1)} s`
              : (boostUnavailableReason ?? 'Listo')}
          </small>
          <i className="touch-button__progress" aria-hidden="true" />
        </button>
        {autoThrottleAvailable && (
          <button
            type="button"
            className={`touch-button touch-button--auto touch-button--auto-${autoThrottleStatus}`}
            aria-label={
              autoThrottleStatus === 'active'
                ? 'Desactivar crucero'
                : 'Activar crucero'
            }
            aria-pressed={autoThrottleStatus !== 'off'}
            disabled={controlsDisabled}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (controlsDisabled) return;
              const enabled = input.toggleAutoThrottle(
                autoThrottleConfig.targetThrottle,
              );
              if (enabled && consumeAutoThrottleHint()) {
                setShowCruiseHint(true);
                if (cruiseHintTimer.current) {
                  clearTimeout(cruiseHintTimer.current);
                }
                cruiseHintTimer.current = setTimeout(
                  () => setShowCruiseHint(false),
                  4_500,
                );
              }
              triggerHaptic('auto-throttle', hapticsEnabled);
            }}
          >
            <strong>AUTO</strong>
            <small>
              {autoThrottleStatus === 'active'
                ? 'Activo'
                : autoThrottleStatus === 'suspended'
                  ? 'En espera'
                  : 'Apagado'}
            </small>
          </button>
        )}
      </div>
      {showCruiseHint && (
        <div className="mobile-cruise-hint" role="status">
          <strong>El vehículo mantendrá la marcha.</strong>
          <span>Toca FRENO para detenerlo.</span>
        </div>
      )}
    </div>
  );
}

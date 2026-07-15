import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { experienceProgress } from '../../game/progression';
import { conditionWarningCopy } from '../../game/conditionWarnings';
import { triggerHaptic } from '../../game/haptics';
import { useSettingsStore } from '../../store/settingsStore';
import { locations } from '../../data/locations';
import { fuelStationConfig } from '../../config/fuelStations.config';
import { onboardingIsActive } from '../../types/onboarding';
import { effectiveDrivingSurfaceLabel } from '../../game/drivingPresentation';

const compassPoints = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

function compassPoint(heading: number): string {
  return compassPoints[Math.round(heading / 45) % compassPoints.length];
}

function PlayerHudContent() {
  const hudRef = useRef<HTMLElement>(null);
  const renderCount = useRef(0);
  const [expandedWhileStopped, setExpandedWhileStopped] = useState(false);
  const [stoppedLongEnough, setStoppedLongEnough] = useState(false);
  const telemetry = useGameStore((state) => state.telemetry);
  const presentationMode = useGameStore((state) => state.presentationMode);
  const onboardingState = useGameStore((state) => state.onboardingState);
  const isPaused = useGameStore((state) => state.isPaused);
  const recoveryReason = useGameStore((state) => state.recoveryReason);
  const activeNarrativeEventId = useGameStore(
    (state) => state.activeNarrativeEventId,
  );
  const activeRadioEventId = useGameStore((state) => state.activeRadioEventId);
  const activeMissionChoiceObjectiveId = useGameStore(
    (state) => state.activeMissionChoiceObjectiveId,
  );
  const lastDiscoveredLocationId = useGameStore(
    (state) => state.lastDiscoveredLocationId,
  );
  const isFollowingPlayer = useGameStore((state) => state.isFollowingPlayer);
  const discoveredCount = useGameStore(
    (state) => state.discoveredLocationIds.length,
  );
  const experience = useGameStore((state) => state.experience);
  const level = useGameStore((state) => state.level);
  const energy = useGameStore((state) => state.energy);
  const maxEnergy = useGameStore((state) => state.maxEnergy);
  const driving = useGameStore((state) => state.driving);
  const insideValidObjectiveZone = useGameStore(
    (state) => state.insideValidObjectiveZone,
  );
  const vehicle = useGameStore((state) => state.vehicle);
  const conditionWarning = useGameStore((state) => state.conditionWarning);
  const dismissConditionWarning = useGameStore(
    (state) => state.dismissConditionWarning,
  );
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const inventoryCount = useGameStore((state) =>
    state.inventory.reduce((total, entry) => total + entry.quantity, 0),
  );
  const progress = experienceProgress(experience);
  const stopped = Math.abs(telemetry.speedKilometersPerHour) < 3;
  const expansionBlocked =
    presentationMode !== 'stopped' ||
    isPaused ||
    onboardingIsActive(onboardingState) ||
    Boolean(
      recoveryReason ||
      activeNarrativeEventId ||
      activeRadioEventId ||
      activeMissionChoiceObjectiveId ||
      lastDiscoveredLocationId,
    );
  const canExpandWhileStopped =
    stopped && stoppedLongEnough && !expansionBlocked;
  const compactStopped = stopped && !expandedWhileStopped;
  const compactDriving = !stopped;

  useEffect(() => {
    if (!stopped) {
      const resetTimer = window.setTimeout(() => {
        setStoppedLongEnough(false);
        setExpandedWhileStopped(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    const timer = window.setTimeout(() => setStoppedLongEnough(true), 3_000);
    return () => window.clearTimeout(timer);
  }, [stopped]);

  useEffect(() => {
    if (!expansionBlocked) return;
    const timer = window.setTimeout(() => setExpandedWhileStopped(false), 0);
    return () => window.clearTimeout(timer);
  }, [expansionBlocked]);

  useEffect(() => {
    renderCount.current += 1;
    if (hudRef.current) {
      hudRef.current.dataset.renderCount = String(renderCount.current);
    }
  });

  useEffect(() => {
    if (!conditionWarning) return;
    triggerHaptic('condition-warning', hapticsEnabled);
    const timer = window.setTimeout(dismissConditionWarning, 4_500);
    return () => window.clearTimeout(timer);
  }, [conditionWarning, dismissConditionWarning, hapticsEnabled]);

  return (
    <>
      <aside
        ref={hudRef}
        className={`player-hud ${compactDriving ? 'player-hud--compact-driving' : ''} ${compactStopped ? 'player-hud--compact-stopped' : ''} ${telemetry.fuel <= fuelStationConfig.lowFuelThreshold ? 'player-hud--fuel-low' : ''} ${telemetry.fuel < fuelStationConfig.criticalFuelThreshold ? 'player-hud--fuel-critical' : ''}`}
        aria-label="Estado del jugador"
        data-presentation-mode={presentationMode}
        data-stopped-for-three-seconds={stoppedLongEnough}
      >
        {stopped && (canExpandWhileStopped || expandedWhileStopped) && (
          <button
            type="button"
            className="player-hud__expand"
            aria-label={
              expandedWhileStopped
                ? 'Contraer información del vehículo'
                : 'Expandir información del vehículo'
            }
            aria-expanded={expandedWhileStopped}
            onClick={() =>
              setExpandedWhileStopped((current) =>
                current ? false : canExpandWhileStopped,
              )
            }
          >
            {expandedWhileStopped ? '−' : '+'}
          </button>
        )}
        <div className="progress-readout">
          <div className="level-badge" aria-label={`Nivel ${level}`}>
            <span>Nivel</span>
            <strong>{level}</strong>
          </div>
          <div className="experience-readout">
            <div>
              <span>Experiencia</span>
              <strong>
                {progress.experienceIntoLevel} /{' '}
                {progress.experienceForNextLevel} XP
              </strong>
            </div>
            <div
              className="experience-meter"
              role="progressbar"
              aria-label="Progreso al siguiente nivel"
              aria-valuemin={0}
              aria-valuemax={progress.experienceForNextLevel}
              aria-valuenow={progress.experienceIntoLevel}
            >
              <span style={{ width: `${progress.ratio * 100}%` }} />
            </div>
            <small>
              Energía {energy.toFixed(0)} / {maxEnergy.toFixed(0)}
            </small>
          </div>
        </div>

        <div className="player-hud__primary">
          <div>
            <span className="hud-label">Velocidad</span>
            <strong data-testid="player-speed">
              {telemetry.speedKilometersPerHour.toFixed(0)}
            </strong>
            <small>km/h</small>
          </div>
          <div
            className="heading-readout"
            aria-label={`Rumbo ${telemetry.heading.toFixed(0)} grados`}
          >
            <span className="heading-readout__arrow" aria-hidden="true">
              ↑
            </span>
            <strong>{compassPoint(telemetry.heading)}</strong>
            <small>{telemetry.heading.toFixed(0)}°</small>
          </div>
        </div>

        <div
          className={`surface-readout surface-readout--${driving.surface}`}
          data-testid="driving-surface"
          role={driving.movementBlockedBy ? 'status' : undefined}
        >
          <div>
            <span className="hud-label">Terreno</span>
            <strong>
              {driving.roadNetworkStatus === 'loading'
                ? 'Analizando vías'
                : driving.roadNetworkStatus === 'unavailable'
                  ? 'Conducción libre'
                  : effectiveDrivingSurfaceLabel(
                      driving.surface,
                      insideValidObjectiveZone,
                    )}
            </strong>
          </div>
          {driving.movementBlockedBy ? (
            <small className="surface-readout__warning">
              {driving.movementBlockedBy === 'water'
                ? 'Agua: paso bloqueado'
                : driving.movementBlockedBy === 'out-of-bounds'
                  ? 'Límite del área jugable'
                  : 'Camino bloqueado'}
            </small>
          ) : driving.roadNetworkStatus === 'ready' ? (
            <small>
              Ritmo {Math.round(driving.speedMultiplier * 100)}% · Consumo{' '}
              {Math.round(driving.fuelMultiplier * 100)}%
            </small>
          ) : (
            <small>
              {driving.roadNetworkStatus === 'loading'
                ? 'Preparando corredor local'
                : 'Sin penalización vial'}
            </small>
          )}
        </div>

        <div className="vehicle-readouts">
          <div className="fuel-readout">
            <div className="fuel-readout__header">
              <span className="hud-label">Combustible</span>
              <strong>{telemetry.fuel.toFixed(1)}%</strong>
            </div>
            <div
              className="fuel-meter"
              role="meter"
              aria-label="Combustible restante"
              aria-valuemin={0}
              aria-valuemax={vehicle.maximumFuel}
              aria-valuenow={Math.round(telemetry.fuel)}
            >
              <span
                style={{
                  width: `${(telemetry.fuel / vehicle.maximumFuel) * 100}%`,
                }}
              />
            </div>
            {telemetry.fuel <= fuelStationConfig.lowFuelThreshold && (
              <small className="fuel-warning" role="status">
                {telemetry.fuel < fuelStationConfig.criticalFuelThreshold
                  ? 'Combustible crítico'
                  : 'Combustible bajo'}
              </small>
            )}
          </div>

          <div className="condition-readout">
            <div className="condition-readout__header">
              <span className="hud-label">Condición</span>
              <strong>{vehicle.condition.toFixed(0)}%</strong>
            </div>
            <div
              className="condition-meter"
              role="meter"
              aria-label="Condición del vehículo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(vehicle.condition)}
            >
              <span style={{ width: `${vehicle.condition}%` }} />
            </div>
            <small>{inventoryCount} objetos</small>
          </div>
        </div>

        <dl className="telemetry-grid">
          <div>
            <dt>Posición</dt>
            <dd data-testid="player-position">
              {telemetry.latitude.toFixed(5)}, {telemetry.longitude.toFixed(5)}
            </dd>
          </div>
          <div>
            <dt>Recorrido</dt>
            <dd>{(telemetry.totalDistanceMeters / 1000).toFixed(2)} km</dd>
          </div>
          <div>
            <dt>Cámara</dt>
            <dd>{isFollowingPlayer ? 'Siguiendo' : 'Libre'}</dd>
          </div>
          <div>
            <dt>Descubiertos</dt>
            <dd>
              {discoveredCount} / {locations.length}
            </dd>
          </div>
        </dl>
      </aside>
      {conditionWarning && (
        <div
          className={`condition-warning condition-warning--${conditionWarning}`}
          role="status"
        >
          <span aria-hidden="true">!</span>
          <div>
            <strong>{conditionWarningCopy[conditionWarning].title}</strong>
            <small>{conditionWarningCopy[conditionWarning].message}</small>
          </div>
        </div>
      )}
    </>
  );
}

export function PlayerHud() {
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);
  return isJournalOpen ? null : <PlayerHudContent />;
}

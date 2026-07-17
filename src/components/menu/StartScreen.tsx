import { useEffect, useState } from 'react';
import { gameConfig } from '../../config/game.config';
import { chapterOneMissionIds } from '../../data/chapter1';
import { locations } from '../../data/locations';
import { progressCounter } from '../../game/progressCounters';
import { loadRoadNetwork, retryRoadNetworkLoad } from '../../roads/roadNetwork';
import { preloadRoadWorker } from '../../roads/roadWorkerClient';
import {
  allowRoadlessStartup,
  beginRoadNetworkStartupAttempt,
  ROAD_NETWORK_STARTUP_DEADLINE_MILLISECONDS,
} from '../../roads/roadStartup';
import { useGameStore } from '../../store/gameStore';
import { fullscreenSupported } from '../../game/fullscreen';
import { SettingsDialog } from './SettingsDialog';
import { InstallExperienceHint } from '../pwa/InstallExperienceHint';
import { VehicleGarageDialog } from '../garage/VehicleGarageDialog';

interface StartScreenProps {
  onContinue: () => void;
  onContinueFullscreen?: () => void;
  onNewGame: () => void;
}

type PreparationStage =
  'map' | 'roads' | 'routes' | 'ready' | 'fallback' | 'error';

export const START_PREPARATION_DEADLINE_MILLISECONDS =
  ROAD_NETWORK_STARTUP_DEADLINE_MILLISECONDS;

const preparationLabels: Readonly<Record<PreparationStage, string>> = {
  map: 'Preparando mapa…',
  roads: 'Preparando carreteras…',
  routes: 'Preparando rutas…',
  ready: 'Listo para conducir',
  fallback: 'Rutas listas en modo compatible sin asistencia vial completa',
  error: 'No se pudo preparar la red vial',
};

const locationIds = locations.map((location) => location.id);

function savedAtLabel(savedAt: string | null): string {
  if (!savedAt) return 'Progreso local disponible';
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return 'Progreso local disponible';
  return `Guardada ${new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)}`;
}

export function StartScreen({
  onContinue,
  onContinueFullscreen,
  onNewGame,
}: StartScreenProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  const [preparationStage, setPreparationStage] =
    useState<PreparationStage>('map');
  const [preparationAttempt, setPreparationAttempt] = useState(0);
  const [canStartFullscreen] = useState(
    () =>
      fullscreenSupported() &&
      !window.matchMedia('(display-mode: standalone)').matches &&
      !window.matchMedia('(display-mode: fullscreen)').matches,
  );
  const hasSavedGame = useGameStore((state) => state.hasSavedGame);
  const lastSavedAt = useGameStore((state) => state.lastSavedAt);
  const level = useGameStore((state) => state.level);
  const discoveredLocationIds = useGameStore(
    (state) => state.discoveredLocationIds,
  );
  const completedMissionIds = useGameStore(
    (state) => state.completedMissionIds,
  );
  const discoveryProgress = progressCounter(locationIds, discoveredLocationIds);
  const missionProgress = progressCounter(
    chapterOneMissionIds,
    completedMissionIds,
  );
  const distance = useGameStore((state) => state.telemetry.totalDistanceMeters);
  const preparationReady =
    preparationStage === 'ready' || preparationStage === 'fallback';

  useEffect(() => {
    let active = true;
    let deadlineReached = false;
    beginRoadNetworkStartupAttempt();
    const deadline = window.setTimeout(() => {
      if (!active) return;
      deadlineReached = true;
      allowRoadlessStartup();
      setPreparationStage('fallback');
    }, START_PREPARATION_DEADLINE_MILLISECONDS);
    const prepare = async () => {
      try {
        setPreparationStage('map');
        const mapModuleReady = import('../map/GameMap');
        setPreparationStage('roads');
        await (preparationAttempt === 0
          ? loadRoadNetwork()
          : retryRoadNetworkLoad());
        if (!active || deadlineReached) return;
        setPreparationStage('routes');
        try {
          const [workerMetrics] = await Promise.all([
            preloadRoadWorker(),
            mapModuleReady,
          ]);
          if (active && !deadlineReached) {
            setPreparationStage(workerMetrics ? 'ready' : 'fallback');
          }
        } catch {
          if (active && !deadlineReached) setPreparationStage('fallback');
        }
      } catch {
        if (active && !deadlineReached) setPreparationStage('error');
      } finally {
        if (!deadlineReached) window.clearTimeout(deadline);
      }
    };
    void prepare();
    return () => {
      active = false;
      window.clearTimeout(deadline);
    };
  }, [preparationAttempt]);

  return (
    <section className="start-screen" aria-labelledby="start-title">
      <div className="start-screen__terrain" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="start-screen__content">
        <span className="start-screen__kicker">Expedición cartográfica</span>
        <h1 id="start-title">{gameConfig.title}</h1>
        <p>
          Recorre el país, sigue señales perdidas y reconstruye una historia
          oculta entre volcanes, lagos y caminos.
        </p>

        {hasSavedGame && (
          <div
            className="start-save-summary"
            aria-label="Resumen de la partida guardada"
          >
            <span>{savedAtLabel(lastSavedAt)}</span>
            <dl>
              <div>
                <dt>Nivel</dt>
                <dd>{level}</dd>
              </div>
              <div>
                <dt>Descubiertos</dt>
                <dd>
                  {discoveryProgress.completed}/{discoveryProgress.total}
                </dd>
              </div>
              <div>
                <dt>Misiones</dt>
                <dd>
                  {missionProgress.completed}/{missionProgress.total}
                </dd>
              </div>
              <div>
                <dt>Recorrido</dt>
                <dd>{(distance / 1_000).toFixed(1)} km</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="start-screen__actions">
          <button
            type="button"
            className="start-button start-button--primary"
            onClick={onContinue}
            disabled={!preparationReady}
          >
            {hasSavedGame ? 'Continuar expedición' : 'Comenzar expedición'}
          </button>
          {canStartFullscreen && onContinueFullscreen && (
            <button
              type="button"
              className="start-button"
              onClick={onContinueFullscreen}
              disabled={!preparationReady}
            >
              {hasSavedGame
                ? 'Continuar en pantalla completa'
                : 'Comenzar en pantalla completa'}
            </button>
          )}
          {hasSavedGame && (
            <>
              <button
                type="button"
                className="start-button"
                onClick={() => setGarageOpen(true)}
              >
                Garaje
              </button>
              <button
                type="button"
                className="start-button"
                onClick={() => setConfirmingNewGame(true)}
                disabled={!preparationReady}
              >
                Nueva partida
              </button>
            </>
          )}
          <button
            type="button"
            className="start-button start-button--quiet"
            onClick={() => setSettingsOpen(true)}
          >
            Configuración
          </button>
        </div>

        <InstallExperienceHint />

        <div
          className={`start-preparation start-preparation--${preparationStage}`}
          role="status"
          data-preparation-stage={preparationStage}
        >
          {preparationStage !== 'ready' &&
            preparationStage !== 'fallback' &&
            preparationStage !== 'error' && (
              <span className="start-preparation__spinner" aria-hidden="true" />
            )}
          <span>{preparationLabels[preparationStage]}</span>
          {preparationStage === 'error' && (
            <button
              type="button"
              onClick={() => setPreparationAttempt((attempt) => attempt + 1)}
            >
              Reintentar
            </button>
          )}
        </div>

        <small className="start-screen__offline">
          Mapa y progreso disponibles sin servicios externos
        </small>
      </div>

      {confirmingNewGame && (
        <div className="confirm-dialog-backdrop">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="new-game-title"
          >
            <span className="confirm-dialog__eyebrow">Reemplazar progreso</span>
            <h2 id="new-game-title">¿Comenzar una nueva expedición?</h2>
            <p>La partida guardada actual se eliminará de este dispositivo.</p>
            <div>
              <button type="button" onClick={() => setConfirmingNewGame(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="confirm-dialog__danger"
                onClick={onNewGame}
              >
                Nueva partida
              </button>
            </div>
          </section>
        </div>
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <VehicleGarageDialog
        open={garageOpen}
        onClose={() => setGarageOpen(false)}
      />
    </section>
  );
}

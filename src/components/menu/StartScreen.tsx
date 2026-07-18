import { useEffect, useRef, useState } from 'react';
import { gameConfig } from '../../config/game.config';
import { chapterOneMissionIds } from '../../data/chapter1';
import { locations } from '../../data/locations';
import { progressCounter } from '../../game/progressCounters';
import { probeMapSourceAvailability } from '../../game/mapSourceAvailability';
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
import { BuildIdentity } from './BuildIdentity';
import { InstallExperienceHint } from '../pwa/InstallExperienceHint';
import { VehicleGarageDialog } from '../garage/VehicleGarageDialog';

interface StartScreenProps {
  onContinue: () => void;
  onContinueFullscreen?: () => void;
  onNewGame: () => void;
}

type PreparationStage =
  'map' | 'roads' | 'routes' | 'ready' | 'fallback' | 'error';
type MapArchiveAvailability = 'checking' | 'available' | 'unavailable';

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
  const [newGameProbePending, setNewGameProbePending] = useState(false);
  const newGameProbe = useRef<AbortController | null>(null);
  const [mapArchiveAvailability, setMapArchiveAvailability] =
    useState<MapArchiveAvailability>('checking');
  const [mapProbeAttempt, setMapProbeAttempt] = useState(0);
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
  const canLaunch = preparationReady && mapArchiveAvailability === 'available';

  useEffect(() => {
    let active = true;
    let activeProbe: AbortController | null = null;
    const probeMap = () => {
      activeProbe?.abort();
      const controller = new AbortController();
      activeProbe = controller;
      setMapArchiveAvailability('checking');
      void probeMapSourceAvailability(controller.signal)
        .then((available) => {
          if (!active || activeProbe !== controller) return;
          setMapArchiveAvailability(available ? 'available' : 'unavailable');
        })
        .catch(() => {
          if (!active || controller.signal.aborted) return;
          setMapArchiveAvailability('unavailable');
        });
    };
    probeMap();
    window.addEventListener('online', probeMap);
    window.addEventListener('offline', probeMap);
    window.addEventListener('focus', probeMap);
    return () => {
      active = false;
      activeProbe?.abort();
      window.removeEventListener('online', probeMap);
      window.removeEventListener('offline', probeMap);
      window.removeEventListener('focus', probeMap);
    };
  }, [mapProbeAttempt]);

  useEffect(
    () => () => {
      newGameProbe.current?.abort();
    },
    [],
  );

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

  const closeNewGameConfirmation = () => {
    newGameProbe.current?.abort();
    newGameProbe.current = null;
    setNewGameProbePending(false);
    setConfirmingNewGame(false);
  };
  const confirmNewGame = () => {
    if (newGameProbe.current) return;
    const controller = new AbortController();
    newGameProbe.current = controller;
    setNewGameProbePending(true);
    void probeMapSourceAvailability(controller.signal)
      .then((available) => {
        if (newGameProbe.current !== controller) return;
        newGameProbe.current = null;
        setNewGameProbePending(false);
        setMapArchiveAvailability(available ? 'available' : 'unavailable');
        if (available) onNewGame();
      })
      .catch(() => {
        if (newGameProbe.current !== controller || controller.signal.aborted) {
          return;
        }
        newGameProbe.current = null;
        setNewGameProbePending(false);
        setMapArchiveAvailability('unavailable');
      });
  };

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
            disabled={!canLaunch}
          >
            {hasSavedGame ? 'Continuar expedición' : 'Comenzar expedición'}
          </button>
          {canStartFullscreen && onContinueFullscreen && (
            <button
              type="button"
              className="start-button"
              onClick={onContinueFullscreen}
              disabled={!canLaunch}
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
                disabled={!canLaunch}
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
          data-map-availability={mapArchiveAvailability}
        >
          {((preparationStage !== 'ready' &&
            preparationStage !== 'fallback' &&
            preparationStage !== 'error') ||
            (preparationReady && mapArchiveAvailability === 'checking')) && (
            <span className="start-preparation__spinner" aria-hidden="true" />
          )}
          <span>
            {preparationReady && mapArchiveAvailability === 'checking'
              ? 'Comprobando archivo del mapa…'
              : preparationReady && mapArchiveAvailability === 'unavailable'
                ? 'Red vial lista · mapa no disponible'
                : preparationLabels[preparationStage]}
          </span>
          {preparationStage === 'error' && (
            <button
              type="button"
              onClick={() => setPreparationAttempt((attempt) => attempt + 1)}
            >
              Reintentar
            </button>
          )}
          {preparationReady && mapArchiveAvailability === 'unavailable' && (
            <button
              type="button"
              onClick={() => setMapProbeAttempt((attempt) => attempt + 1)}
            >
              Reintentar mapa
            </button>
          )}
        </div>

        <small className="start-screen__offline">
          {mapArchiveAvailability === 'available'
            ? 'Mapa y progreso locales, sin servicios externos.'
            : mapArchiveAvailability === 'checking'
              ? 'Comprobando el mapa local antes de conducir.'
              : 'Inicio, red vial y progreso disponibles. El mapa no está accesible; reintenta cuando vuelva la conexión con este servidor.'}
        </small>
        <BuildIdentity />
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
            <p>
              {mapArchiveAvailability === 'unavailable'
                ? 'El mapa no está disponible. Tu partida guardada no se modificó.'
                : newGameProbePending
                  ? 'Verificando el mapa antes de reemplazar tu progreso…'
                  : 'La partida guardada actual se eliminará de este dispositivo.'}
            </p>
            <div>
              <button type="button" onClick={closeNewGameConfirmation}>
                Cancelar
              </button>
              <button
                type="button"
                className="confirm-dialog__danger"
                onClick={confirmNewGame}
                disabled={!canLaunch || newGameProbePending}
              >
                {newGameProbePending ? 'Verificando mapa…' : 'Nueva partida'}
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

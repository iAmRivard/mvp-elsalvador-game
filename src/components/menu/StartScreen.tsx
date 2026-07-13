import { useState } from 'react';
import { gameConfig } from '../../config/game.config';
import { useGameStore } from '../../store/gameStore';
import { SettingsDialog } from './SettingsDialog';

interface StartScreenProps {
  onContinue: () => void;
  onNewGame: () => void;
}

function savedAtLabel(savedAt: string | null): string {
  if (!savedAt) return 'Progreso local disponible';
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return 'Progreso local disponible';
  return `Guardada ${new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)}`;
}

export function StartScreen({ onContinue, onNewGame }: StartScreenProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  const hasSavedGame = useGameStore((state) => state.hasSavedGame);
  const lastSavedAt = useGameStore((state) => state.lastSavedAt);
  const level = useGameStore((state) => state.level);
  const discovered = useGameStore(
    (state) => state.discoveredLocationIds.length,
  );
  const completed = useGameStore((state) => state.completedMissionIds.length);
  const distance = useGameStore((state) => state.telemetry.totalDistanceMeters);

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
                <dd>{discovered}/12</dd>
              </div>
              <div>
                <dt>Misiones</dt>
                <dd>{completed}/3</dd>
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
          >
            {hasSavedGame ? 'Continuar expedición' : 'Comenzar expedición'}
          </button>
          {hasSavedGame && (
            <button
              type="button"
              className="start-button"
              onClick={() => setConfirmingNewGame(true)}
            >
              Nueva partida
            </button>
          )}
          <button
            type="button"
            className="start-button start-button--quiet"
            onClick={() => setSettingsOpen(true)}
          >
            Configuración
          </button>
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
    </section>
  );
}

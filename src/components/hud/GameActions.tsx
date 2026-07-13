import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { SettingsDialog } from '../menu/SettingsDialog';

function savedAtLabel(savedAt: string | null): string {
  if (!savedAt) return 'Sin guardado todavía';
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return 'Guardado disponible';
  return `Último guardado: ${new Intl.DateTimeFormat('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}`;
}

export function GameActions() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isPaused = useGameStore((state) => state.isPaused);
  const isFollowingPlayer = useGameStore((state) => state.isFollowingPlayer);
  const hasSavedGame = useGameStore((state) => state.hasSavedGame);
  const lastSavedAt = useGameStore((state) => state.lastSavedAt);
  const saveMessage = useGameStore((state) => state.saveMessage);
  const togglePaused = useGameStore((state) => state.togglePaused);
  const setFollowingPlayer = useGameStore((state) => state.setFollowingPlayer);
  const saveGame = useGameStore((state) => state.saveGame);
  const loadGame = useGameStore((state) => state.loadGame);
  const resetGame = useGameStore((state) => state.resetGame);

  return (
    <>
      <div className="game-actions" aria-label="Acciones del juego">
        <button
          className={`icon-button ${settingsOpen ? 'icon-button--active' : ''}`}
          type="button"
          aria-label="Configuración visual"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(true)}
        >
          <span aria-hidden="true">⚙</span>
        </button>
        <button
          className={`icon-button ${isFollowingPlayer ? 'icon-button--active' : ''}`}
          type="button"
          aria-label={
            isFollowingPlayer ? 'Desactivar seguimiento' : 'Seguir al jugador'
          }
          aria-pressed={isFollowingPlayer}
          onClick={() => setFollowingPlayer(!isFollowingPlayer)}
        >
          <span aria-hidden="true">⌖</span>
        </button>
        <button
          className={`icon-button ${isPaused ? 'icon-button--active' : ''}`}
          type="button"
          aria-label={isPaused ? 'Reanudar partida' : 'Pausar partida'}
          aria-pressed={isPaused}
          onClick={togglePaused}
        >
          <span aria-hidden="true">{isPaused ? '▶' : 'Ⅱ'}</span>
        </button>
        <button
          className={`icon-button ${menuOpen ? 'icon-button--active' : ''}`}
          type="button"
          aria-label="Partida y guardado"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">▣</span>
        </button>

        {menuOpen && (
          <div className="save-menu" role="menu">
            <div className="save-menu__header">
              <span>Progreso local</span>
              <small>{savedAtLabel(lastSavedAt)}</small>
            </div>
            {saveMessage && (
              <p className="save-menu__message" role="status">
                {saveMessage}
              </p>
            )}
            <button type="button" role="menuitem" onClick={() => saveGame()}>
              <span aria-hidden="true">↓</span>
              Guardar ahora
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!hasSavedGame}
              onClick={() => loadGame()}
            >
              <span aria-hidden="true">↻</span>
              Cargar último guardado
            </button>
            <button
              type="button"
              role="menuitem"
              className="save-menu__danger"
              onClick={() => setConfirmingReset(true)}
            >
              <span aria-hidden="true">×</span>
              Reiniciar partida
            </button>
          </div>
        )}
      </div>

      {confirmingReset && (
        <div className="confirm-dialog-backdrop">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            aria-describedby="reset-description"
          >
            <span className="confirm-dialog__eyebrow">Acción irreversible</span>
            <h2 id="reset-title">¿Reiniciar la expedición?</h2>
            <p id="reset-description">
              Se borrarán la posición, misiones, descubrimientos y recompensas
              guardadas en este dispositivo.
            </p>
            <div>
              <button type="button" onClick={() => setConfirmingReset(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="confirm-dialog__danger"
                onClick={() => {
                  resetGame();
                  setConfirmingReset(false);
                  setMenuOpen(false);
                }}
              >
                Reiniciar partida
              </button>
            </div>
          </section>
        </div>
      )}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        allowTutorial
      />
    </>
  );
}

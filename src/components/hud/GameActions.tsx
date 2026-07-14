import { useEffect, useState } from 'react';
import { requestInputClear } from '../../game/inputEvents';
import { consumeMobileActionLabels } from '../../game/mobileControlHelp';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { SettingsDialog } from '../menu/SettingsDialog';
import { InventoryDialog } from '../menu/InventoryDialog';
import { IconButton } from '../ui/IconButton';

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
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [showMobileLabels, setShowMobileLabels] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none), (pointer: coarse), (max-width: 600px)')
      .matches
      ? consumeMobileActionLabels()
      : false,
  );
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
  const setTutorialSeen = useSettingsStore((state) => state.setTutorialSeen);

  useEffect(() => {
    if (!showMobileLabels) return;
    const timer = window.setTimeout(() => setShowMobileLabels(false), 4_500);
    return () => window.clearTimeout(timer);
  }, [showMobileLabels]);

  return (
    <>
      <div className="game-actions" aria-label="Acciones del juego">
        <IconButton
          className="game-action--desktop"
          label="Inventario"
          icon="▤"
          active={inventoryOpen}
          aria-expanded={inventoryOpen}
          onClick={() => {
            requestInputClear();
            setInventoryOpen(true);
          }}
        />
        <IconButton
          className="game-action--desktop"
          label="Configuración"
          icon="⚙"
          active={settingsOpen}
          aria-expanded={settingsOpen}
          onClick={() => {
            requestInputClear();
            setSettingsOpen(true);
          }}
        />
        <IconButton
          className="game-action--desktop"
          label="Seguir vehículo"
          icon="⌖"
          active={isFollowingPlayer}
          aria-pressed={isFollowingPlayer}
          onClick={() => setFollowingPlayer(!isFollowingPlayer)}
        />
        <IconButton
          className="game-action--desktop"
          label={isPaused ? 'Reanudar' : 'Pausar'}
          icon={isPaused ? '▶' : 'Ⅱ'}
          active={isPaused}
          aria-pressed={isPaused}
          onClick={togglePaused}
        />
        <IconButton
          label="Partida y guardado"
          icon={
            <>
              <span className="game-action__desktop-icon">▣</span>
              <span className="game-action__mobile-icon">⋯</span>
            </>
          }
          active={menuOpen}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => {
            requestInputClear();
            setMenuOpen((open) => !open);
          }}
        />

        {showMobileLabels && (
          <div className="mobile-action-labels" role="status">
            <span>▤ Inventario</span>
            <span>⚙ Ajustes</span>
            <span>⌖ Seguir</span>
            <span>Ⅱ Pausa</span>
            <span>▣ Guardado</span>
          </div>
        )}

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
            <button
              type="button"
              role="menuitem"
              className="save-menu__mobile-action"
              onClick={() => {
                requestInputClear();
                setInventoryOpen(true);
                setMenuOpen(false);
              }}
            >
              <span aria-hidden="true">▤</span>
              Inventario
            </button>
            <button
              type="button"
              role="menuitem"
              className="save-menu__mobile-action"
              onClick={() => {
                requestInputClear();
                setSettingsOpen(true);
                setMenuOpen(false);
              }}
            >
              <span aria-hidden="true">⚙</span>
              Configuración
            </button>
            <button type="button" role="menuitem" onClick={() => saveGame()}>
              <span aria-hidden="true">↓</span>
              Guardar ahora
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!hasSavedGame}
              onClick={() => {
                requestInputClear();
                loadGame();
              }}
            >
              <span aria-hidden="true">↻</span>
              Cargar último guardado
            </button>
            <button
              type="button"
              role="menuitem"
              className="save-menu__mobile-action"
              onClick={() => {
                requestInputClear();
                setTutorialSeen(false);
                setMenuOpen(false);
              }}
            >
              <span aria-hidden="true">?</span>
              Ayuda
            </button>
            <button
              type="button"
              role="menuitem"
              className="save-menu__mobile-action"
              onClick={() => {
                requestInputClear();
                setSettingsOpen(true);
                setMenuOpen(false);
              }}
            >
              <span aria-hidden="true">⌘</span>
              Controles
            </button>
            <button
              type="button"
              role="menuitem"
              className="save-menu__danger"
              onClick={() => {
                requestInputClear();
                setConfirmingReset(true);
              }}
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
                  requestInputClear();
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
      <InventoryDialog
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
      />
    </>
  );
}

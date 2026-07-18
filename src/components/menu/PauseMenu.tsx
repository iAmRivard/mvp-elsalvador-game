import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { SettingsDialog } from './SettingsDialog';
import { FullscreenButton } from '../pwa/FullscreenButton';
import { VehicleGarageDialog } from '../garage/VehicleGarageDialog';
import { BuildIdentity } from './BuildIdentity';

interface PauseMenuProps {
  onExitToTitle: () => void;
}

export function PauseMenu({ onExitToTitle }: PauseMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const level = useGameStore((state) => state.level);
  const experience = useGameStore((state) => state.experience);
  const setPaused = useGameStore((state) => state.setPaused);
  const saveGame = useGameStore((state) => state.saveGame);
  const saveMessage = useGameStore((state) => state.saveMessage);
  const setOnboardingState = useGameStore((state) => state.setOnboardingState);

  if (garageOpen) {
    return <VehicleGarageDialog open onClose={() => setGarageOpen(false)} />;
  }

  return (
    <div className="pause-menu-backdrop">
      <section
        className="pause-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
      >
        <span className="pause-menu__eyebrow">Expedición detenida</span>
        <h2 id="pause-title">Partida en pausa</h2>
        <p>
          Nivel {level} · {experience} XP
        </p>
        {saveMessage && (
          <span className="pause-menu__status" role="status">
            {saveMessage}
          </span>
        )}
        <div className="pause-menu__actions">
          <button
            type="button"
            className="pause-menu__primary"
            onClick={() => setPaused(false)}
          >
            Continuar
          </button>
          <button type="button" onClick={() => saveGame()}>
            Guardar ahora
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)}>
            Configuración
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)}>
            Controles
          </button>
          <button type="button" onClick={() => setGarageOpen(true)}>
            Garaje
          </button>
          <button
            type="button"
            onClick={() => {
              setOnboardingState('driving-basics');
              setPaused(false);
            }}
          >
            Ver tutorial
          </button>
          <FullscreenButton />
          <button
            type="button"
            className="pause-menu__exit"
            onClick={() => {
              saveGame(true);
              onExitToTitle();
            }}
          >
            Volver al inicio
          </button>
        </div>
        <small>También puedes presionar Escape para continuar.</small>
        <BuildIdentity />
      </section>
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        allowTutorial
      />
    </div>
  );
}

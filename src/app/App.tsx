import { lazy, Suspense, useEffect, useState } from 'react';
import { GameActions } from '../components/hud/GameActions';
import { CurrentRegion } from '../components/hud/CurrentRegion';
import { DiscoveryToast } from '../components/hud/DiscoveryToast';
import { LevelUpToast } from '../components/hud/LevelUpToast';
import { MissionPanel } from '../components/hud/MissionPanel';
import { MissionToast } from '../components/hud/MissionToast';
import { PlayerHud } from '../components/hud/PlayerHud';
import { PauseMenu } from '../components/menu/PauseMenu';
import { StartScreen } from '../components/menu/StartScreen';
import { TutorialOverlay } from '../components/menu/TutorialOverlay';
import { gameConfig } from '../config/game.config';
import { startGameAutosave, useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';

const GameMap = lazy(async () => {
  const module = await import('../components/map/GameMap');
  return { default: module.GameMap };
});

export function App() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const hasSavedGame = useGameStore((state) => state.hasSavedGame);
  const isPaused = useGameStore((state) => state.isPaused);
  const setPaused = useGameStore((state) => state.setPaused);
  const loadGame = useGameStore((state) => state.loadGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const tutorialSeen = useSettingsStore((state) => state.tutorialSeen);
  const setTutorialSeen = useSettingsStore((state) => state.setTutorialSeen);
  const showTutorial = sessionStarted && !tutorialSeen;

  useEffect(() => startGameAutosave(), []);
  useEffect(() => {
    if (showTutorial) setPaused(true);
  }, [setPaused, showTutorial]);

  const enterGame = (loadSavedGame: boolean) => {
    if (loadSavedGame && hasSavedGame) loadGame();
    setPaused(!tutorialSeen);
    setSessionStarted(true);
  };

  if (!sessionStarted) {
    return (
      <main className="game-shell game-shell--title">
        <StartScreen
          onContinue={() => enterGame(hasSavedGame)}
          onNewGame={() => {
            resetGame();
            enterGame(false);
          }}
        />
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-eyebrow">Exploración 2.5D</span>
          <h1>{gameConfig.title}</h1>
        </div>
        <div className="topbar__right">
          <CurrentRegion />
          <GameActions />
        </div>
      </header>

      <section className="map-stage" aria-label="Mapa del juego">
        <Suspense
          fallback={
            <div className="map-message" role="status">
              Preparando el motor cartográfico…
            </div>
          }
        >
          <GameMap />
        </Suspense>

        <PlayerHud />
        <MissionPanel />
        <DiscoveryToast />
        <MissionToast />
        <LevelUpToast />

        <div className="controls-hint" aria-label="Controles disponibles">
          <span>WASD o flechas para conducir</span>
          <span className="controls-hint__divider" aria-hidden="true" />
          <span>Shift: turbo · Espacio: investigar · Escape: pausa</span>
        </div>
      </section>

      {showTutorial && (
        <TutorialOverlay
          onComplete={() => {
            setTutorialSeen(true);
            setPaused(false);
          }}
        />
      )}
      {isPaused && !showTutorial && (
        <PauseMenu
          onExitToTitle={() => {
            setPaused(true);
            setSessionStarted(false);
          }}
        />
      )}
    </main>
  );
}

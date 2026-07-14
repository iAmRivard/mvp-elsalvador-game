import { lazy, Suspense, useEffect, useState } from 'react';
import { DiagnosticsPanel } from '../components/dev/DiagnosticsPanel';
import { GameActions } from '../components/hud/GameActions';
import { GameAudioBridge } from '../components/audio/GameAudioBridge';
import { CurrentRegion } from '../components/hud/CurrentRegion';
import { DiscoveryToast } from '../components/hud/DiscoveryToast';
import { LevelUpToast } from '../components/hud/LevelUpToast';
import { MissionPanel } from '../components/hud/MissionPanel';
import { MissionToast } from '../components/hud/MissionToast';
import { PlayerHud } from '../components/hud/PlayerHud';
import { PauseMenu } from '../components/menu/PauseMenu';
import { VehicleRecoveryDialog } from '../components/menu/VehicleRecoveryDialog';
import { StartScreen } from '../components/menu/StartScreen';
import { TutorialOverlay } from '../components/menu/TutorialOverlay';
import { NarrativeDialog } from '../components/story/NarrativeDialog';
import { gameConfig } from '../config/game.config';
import { InputController } from '../game/inputController';
import { startGameAutosave, useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';

const GameMap = lazy(async () => {
  const module = await import('../components/map/GameMap');
  return { default: module.GameMap };
});

const diagnosticsEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DIAGNOSTICS === 'true';

export function App() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [inputController] = useState(() => new InputController());
  const hasSavedGame = useGameStore((state) => state.hasSavedGame);
  const isPaused = useGameStore((state) => state.isPaused);
  const recoveryReason = useGameStore((state) => state.recoveryReason);
  const activeNarrativeEventId = useGameStore(
    (state) => state.activeNarrativeEventId,
  );
  const setPaused = useGameStore((state) => state.setPaused);
  const loadGame = useGameStore((state) => state.loadGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const tutorialSeen = useSettingsStore((state) => state.tutorialSeen);
  const setTutorialSeen = useSettingsStore((state) => state.setTutorialSeen);
  const showTutorial = sessionStarted && !tutorialSeen;

  useEffect(() => startGameAutosave(), []);
  useEffect(() => {
    if (showTutorial) setPaused(false);
  }, [setPaused, showTutorial]);

  const enterGame = (loadSavedGame: boolean) => {
    if (loadSavedGame && hasSavedGame) loadGame();
    setPaused(false);
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
      <GameAudioBridge />
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
          <GameMap inputController={inputController} />
        </Suspense>

        <PlayerHud />
        <MissionPanel />
        {!showTutorial && <DiscoveryToast />}
        <MissionToast />
        <LevelUpToast />
        {diagnosticsEnabled && <DiagnosticsPanel input={inputController} />}
      </section>

      {showTutorial && (
        <TutorialOverlay
          input={inputController}
          onComplete={() => {
            setTutorialSeen(true);
            setPaused(false);
          }}
        />
      )}
      {isPaused &&
        !showTutorial &&
        !recoveryReason &&
        !activeNarrativeEventId && (
          <PauseMenu
            onExitToTitle={() => {
              setPaused(true);
              setSessionStarted(false);
            }}
          />
        )}
      <VehicleRecoveryDialog />
      <NarrativeDialog />
    </main>
  );
}

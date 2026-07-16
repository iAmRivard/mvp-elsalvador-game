import { lazy, Suspense, useEffect, useState } from 'react';
import { DiagnosticsPanel } from '../components/dev/DiagnosticsPanel';
import { GameActions } from '../components/hud/GameActions';
import { FuelAssist } from '../components/hud/FuelAssist';
import { GameplayToast } from '../components/hud/GameplayToast';
import { GameAudioBridge } from '../components/audio/GameAudioBridge';
import { CurrentRegion } from '../components/hud/CurrentRegion';
import { LevelUpToast } from '../components/hud/LevelUpToast';
import { MissionPanel } from '../components/hud/MissionPanel';
import { MissionToast } from '../components/hud/MissionToast';
import { MissionTimer } from '../components/hud/MissionTimer';
import { PlayerHud } from '../components/hud/PlayerHud';
import { MobileDrivingHud } from '../components/hud/MobileDrivingHud';
import { PauseMenu } from '../components/menu/PauseMenu';
import { RecommendedControlsPrompt } from '../components/menu/RecommendedControlsPrompt';
import { StartScreen } from '../components/menu/StartScreen';
import { ServiceWorkerUpdatePrompt } from '../components/pwa/ServiceWorkerUpdatePrompt';
import { OverlayManager } from '../components/ui/OverlayManager';
import { gameConfig } from '../config/game.config';
import { diagnosticsEnabled } from '../config/diagnostics.config';
import { requestGameFullscreen } from '../game/fullscreen';
import { InputController } from '../game/inputController';
import { onboardingIsActive } from '../types/onboarding';
import { startGameAutosave, useGameStore } from '../store/gameStore';

const GameMap = lazy(async () => {
  const module = await import('../components/map/GameMap');
  return { default: module.GameMap };
});

export function App() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [inputController] = useState(() => new InputController());
  const hasSavedGame = useGameStore((state) => state.hasSavedGame);
  const isPaused = useGameStore((state) => state.isPaused);
  const presentationMode = useGameStore((state) => state.presentationMode);
  const recoveryReason = useGameStore((state) => state.recoveryReason);
  const activeMissionId = useGameStore((state) => state.activeMissionId);
  const onboardingState = useGameStore((state) => state.onboardingState);
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);
  const activeNarrativeEventId = useGameStore(
    (state) => state.activeNarrativeEventId,
  );
  const activeMissionChoiceObjectiveId = useGameStore(
    (state) => state.activeMissionChoiceObjectiveId,
  );
  const setPaused = useGameStore((state) => state.setPaused);
  const loadGame = useGameStore((state) => state.loadGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const beginOnboardingExpedition = useGameStore(
    (state) => state.beginOnboardingExpedition,
  );
  const showTutorial =
    sessionStarted &&
    onboardingState !== 'introducing' &&
    onboardingIsActive(onboardingState);

  useEffect(() => startGameAutosave(), []);
  useEffect(() => {
    if (isJournalOpen) inputController.suspendForOverlay();
    else inputController.resumeFromOverlay();
  }, [inputController, isJournalOpen]);
  const enterGame = (loadSavedGame: boolean) => {
    const loaded = loadSavedGame && hasSavedGame && loadGame();
    if (!loaded) {
      beginOnboardingExpedition();
    } else {
      setPaused(false);
    }
    setSessionStarted(true);
  };
  const enterFullscreenExpedition = async (loadSavedGame: boolean) => {
    await requestGameFullscreen();
    enterGame(loadSavedGame);
  };

  if (!sessionStarted) {
    return (
      <main className="game-shell game-shell--title">
        <StartScreen
          onContinue={() => enterGame(hasSavedGame)}
          onContinueFullscreen={() =>
            void enterFullscreenExpedition(hasSavedGame)
          }
          onNewGame={() => {
            inputController.clearAllInput();
            inputController.resetMobileBoostCompletely();
            resetGame();
            enterGame(false);
          }}
        />
        <ServiceWorkerUpdatePrompt deferUpdate={Boolean(activeMissionId)} />
      </main>
    );
  }

  return (
    <main
      className={`game-shell game-shell--${presentationMode}`}
      data-driving-mode={presentationMode}
    >
      <GameAudioBridge input={inputController} />
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-eyebrow">Exploración 2.5D</span>
          <h1>
            <span className="brand-title--full">{gameConfig.title}</span>
            <span className="brand-title--compact">Rutas Perdidas</span>
          </h1>
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
          <GameMap
            inputController={inputController}
            onExitToTitle={() => {
              inputController.clearAllInput();
              setPaused(true);
              setSessionStarted(false);
            }}
          />
        </Suspense>

        {!isJournalOpen && <PlayerHud />}
        {!isJournalOpen &&
          !showTutorial &&
          !recoveryReason &&
          !activeNarrativeEventId &&
          !activeMissionChoiceObjectiveId && <MobileDrivingHud />}
        {!isJournalOpen && !showTutorial && <FuelAssist />}
        <MissionTimer />
        <MissionPanel />
        <MissionToast />
        <GameplayToast />
        <OverlayManager
          input={inputController}
          showTutorial={showTutorial}
          showContextualAdvice={
            onboardingState === 'completed' || onboardingState === 'skipped'
          }
          allowDiscovery={!showTutorial}
          allowStory={!isJournalOpen}
          onTutorialComplete={() => setPaused(false)}
          onTutorialSkip={() => setPaused(false)}
        />
        <LevelUpToast />
        {diagnosticsEnabled && <DiagnosticsPanel input={inputController} />}
      </section>

      {isPaused &&
        !showTutorial &&
        !isJournalOpen &&
        !recoveryReason &&
        !activeNarrativeEventId &&
        !activeMissionChoiceObjectiveId && (
          <PauseMenu
            onExitToTitle={() => {
              setPaused(true);
              setSessionStarted(false);
            }}
          />
        )}
      <RecommendedControlsPrompt />
      <ServiceWorkerUpdatePrompt deferUpdate={Boolean(activeMissionId)} />
    </main>
  );
}

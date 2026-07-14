import { useEffect } from 'react';
import { gameAudio } from '../../audio/gameAudio';
import { travelConfig } from '../../config/travel.config';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';

function configureAudio(): void {
  const settings = useSettingsStore.getState();
  gameAudio.configure({
    masterVolume: settings.audioMasterVolume,
    effectsVolume: settings.audioEffectsVolume,
    muted: settings.audioMuted,
    reducedEffects: settings.reduceAudioEffects,
  });
}

function updateVehicleAudio(): void {
  const state = useGameStore.getState();
  gameAudio.updateVehicle({
    speedRatio:
      Math.abs(state.telemetry.speedMetersPerSecond) /
      travelConfig.boostMaximumSpeedMetersPerSecond,
    offroad: state.driving.surface === 'offroad',
    paused: state.isPaused,
  });
}

export function GameAudioBridge() {
  useEffect(() => {
    configureAudio();
    updateVehicleAudio();
    const unlock = () => {
      void gameAudio.unlock();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });

    const unsubscribeSettings = useSettingsStore.subscribe(configureAudio);
    const unsubscribeGame = useGameStore.subscribe((state, previousState) => {
      updateVehicleAudio();
      if (
        state.activeMissionId &&
        state.activeMissionId !== previousState.activeMissionId
      ) {
        gameAudio.play('missionStart');
      }
      if (
        state.activeMissionId === previousState.activeMissionId &&
        state.activeMissionCompletedObjectiveIds.length >
          previousState.activeMissionCompletedObjectiveIds.length
      ) {
        gameAudio.play('objectiveComplete');
      }
      if (
        state.lastCompletedMissionId &&
        state.lastCompletedMissionId !== previousState.lastCompletedMissionId
      ) {
        gameAudio.play('objectiveComplete');
      }
      if (
        state.discoveredLocationIds.length >
        previousState.discoveredLocationIds.length
      ) {
        gameAudio.play('discovery');
      }
      if (state.telemetry.fuel <= 20 && previousState.telemetry.fuel > 20) {
        gameAudio.play('lowFuel');
      }
      if (
        state.activeNarrativeEventId &&
        state.activeNarrativeEventId !== previousState.activeNarrativeEventId
      ) {
        gameAudio.play('radioInterference');
      }
    });

    return () => {
      unsubscribeGame();
      unsubscribeSettings();
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      gameAudio.shutdown();
    };
  }, []);

  return null;
}

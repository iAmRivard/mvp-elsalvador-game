import { useEffect } from 'react';
import { gameAudio } from '../../audio/gameAudio';
import { musicStateForGame } from '../../audio/musicState';
import { travelConfig } from '../../config/travel.config';
import { missionById } from '../../data/missions';
import { activeMissionTimer } from '../../game/missionTimer';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { fuelStationConfig } from '../../config/fuelStations.config';

function configureAudio(): void {
  const settings = useSettingsStore.getState();
  gameAudio.configure({
    masterVolume: settings.audioMasterVolume,
    effectsVolume: settings.audioEffectsVolume,
    musicVolume: settings.audioMusicVolume,
    muted: settings.audioMuted,
    musicMuted: settings.musicMuted,
    reducedEffects: settings.reduceAudioEffects,
  });
}

function updateAdaptiveMusic(): number | null {
  const state = useGameStore.getState();
  const mission = state.activeMissionId
    ? (missionById.get(state.activeMissionId) ?? null)
    : null;
  const timer = activeMissionTimer(
    mission,
    state.activeMissionCompletedObjectiveIds,
    state.activeMissionObjectiveProgress,
  );
  const timerRunning = Boolean(
    timer && state.missionTimerCountdownSeconds <= 0,
  );
  gameAudio.updateMusic({
    state: musicStateForGame(
      state.activeMissionId,
      timerRunning,
      Boolean(state.recoveryReason),
    ),
    radioActive: Boolean(state.activeRadioEventId),
    paused: state.isPaused,
    timedIntensity: timer
      ? 1 - timer.remainingSeconds / timer.durationSeconds
      : 0,
  });
  return timerRunning && timer ? Math.ceil(timer.remainingSeconds) : null;
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
    let previousTimerSecond = updateAdaptiveMusic();
    const unlock = () => {
      void gameAudio.unlock();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });

    const unsubscribeSettings = useSettingsStore.subscribe(configureAudio);
    const unsubscribeGame = useGameStore.subscribe((state, previousState) => {
      updateVehicleAudio();
      const timerSecond = updateAdaptiveMusic();
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
      if (
        state.telemetry.fuel <= fuelStationConfig.lowFuelThreshold &&
        previousState.telemetry.fuel > fuelStationConfig.lowFuelThreshold
      ) {
        gameAudio.play('lowFuel');
      }
      if (
        (state.activeRadioEventId &&
          state.activeRadioEventId !== previousState.activeRadioEventId) ||
        (state.activeNarrativeEventId &&
          state.activeNarrativeEventId !== previousState.activeNarrativeEventId)
      ) {
        gameAudio.play('radioInterference');
      }
      if (
        timerSecond !== null &&
        timerSecond !== previousTimerSecond &&
        (timerSecond === 60 ||
          timerSecond === 30 ||
          (timerSecond <= 10 && timerSecond > 0))
      ) {
        gameAudio.play('timerWarning');
      }
      previousTimerSecond = timerSecond;
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

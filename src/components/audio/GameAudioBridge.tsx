import { useEffect } from 'react';
import {
  adaptiveMusicStateChanged,
  vehicleAudioStateChanged,
} from '../../audio/audioStoreChanges';
import { gameAudio } from '../../audio/gameAudio';
import { musicStateForGame } from '../../audio/musicState';
import { missionById } from '../../data/missions';
import { vehicleDefinitionFor, vehicleRuntimeFor } from '../../data/vehicles';
import { activeMissionTimer } from '../../game/missionTimer';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { fuelStationConfig } from '../../config/fuelStations.config';
import type { InputController } from '../../game/inputController';

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

function updateVehicleAudio(input: InputController): void {
  const state = useGameStore.getState();
  const drivingInput = input.getDiagnostics();
  const maximumBoostSpeed = vehicleRuntimeFor(state.selectedVehicleId).handling
    .maximumBoostSpeed;
  const audioProfileId = vehicleDefinitionFor(
    state.selectedVehicleId,
  ).audioProfileId;
  gameAudio.updateVehicle({
    normalizedSpeed:
      Math.abs(state.telemetry.speedMetersPerSecond) / maximumBoostSpeed,
    accelerationIntent: drivingInput.throttle,
    boostActive: drivingInput.boost,
    surface: state.driving.surface,
    paused: state.isPaused,
    profileId: audioProfileId,
  });
}

export function GameAudioBridge({ input }: { input: InputController }) {
  useEffect(() => {
    configureAudio();
    updateVehicleAudio(input);
    let previousTimerSecond = updateAdaptiveMusic();
    const unlock = () => {
      void gameAudio.unlock();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });

    const unsubscribeSettings = useSettingsStore.subscribe(configureAudio);
    const unsubscribeInput = input.subscribe(() => updateVehicleAudio(input));
    const unsubscribeGame = useGameStore.subscribe((state, previousState) => {
      if (vehicleAudioStateChanged(state, previousState)) {
        updateVehicleAudio(input);
      }
      const timerSecond = adaptiveMusicStateChanged(state, previousState)
        ? updateAdaptiveMusic()
        : previousTimerSecond;
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
      unsubscribeInput();
      unsubscribeSettings();
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      gameAudio.shutdown();
    };
  }, [input]);

  return null;
}

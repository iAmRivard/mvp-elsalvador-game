import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  controlViewportScale,
  joystickSizeMultipliers,
  virtualJoystickConfig,
} from '../../config/mobileControls.config';
import { missionById } from '../../data/missions';
import type { InputController } from '../../game/inputController';
import {
  interactionLabelForObjective,
  objectiveRequiresManualInteraction,
} from '../../game/interactions';
import { triggerHaptic } from '../../game/haptics';
import { nearestPendingObjective } from '../../game/missions';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { onboardingIsActive } from '../../types/onboarding';
import { ClassicTouchControls } from './ClassicTouchControls';
import { MobileActionButtons } from './MobileActionButtons';
import { MobilePedals } from './MobilePedals';
import { VirtualJoystick } from './VirtualJoystick';

interface TouchControlsProps {
  input: InputController;
}

const cruiseGearLabels = {
  stopped: 'DETENIDO',
  slow: 'LENTO',
  cruise: 'CRUCERO',
  fast: 'RÁPIDO',
} as const;

function TouchControlsContent({ input }: TouchControlsProps) {
  const [viewportScale, setViewportScale] = useState(() =>
    typeof window === 'undefined'
      ? 1
      : controlViewportScale(window.innerHeight),
  );
  const isPaused = useGameStore((state) => state.isPaused);
  const controlsDisabled = useGameStore(
    (state) =>
      state.isPaused ||
      state.activeNarrativeEventId !== null ||
      state.activeMissionChoiceObjectiveId !== null ||
      state.recoveryReason !== null ||
      state.vehicle.condition <= 0,
  );
  const togglePaused = useGameStore((state) => state.togglePaused);
  const setFollowingPlayer = useGameStore((state) => state.setFollowingPlayer);
  const activeMissionId = useGameStore((state) => state.activeMissionId);
  const onboardingState = useGameStore((state) => state.onboardingState);
  const completedObjectiveIds = useGameStore(
    (state) => state.activeMissionCompletedObjectiveIds,
  );
  const telemetry = useGameStore((state) => state.telemetry);
  const controlMode = useSettingsStore((state) => state.controlMode);
  const joystickPositionMode = useSettingsStore(
    (state) => state.joystickPositionMode,
  );
  const joystickSize = useSettingsStore((state) => state.joystickSize);
  const joystickDeadZone = useSettingsStore((state) => state.joystickDeadZone);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const activeMission = activeMissionId
    ? missionById.get(activeMissionId)
    : null;
  const nearestObjective = activeMission
    ? nearestPendingObjective(activeMission, completedObjectiveIds, [
        telemetry.longitude,
        telemetry.latitude,
      ])
    : null;
  const interactionObjective = nearestObjective?.objective;
  const interactionLabel =
    !onboardingIsActive(onboardingState) &&
    interactionObjective &&
    objectiveRequiresManualInteraction(interactionObjective) &&
    nearestObjective.distanceMeters <= interactionObjective.radiusMeters
      ? interactionLabelForObjective(interactionObjective)
      : null;
  const sizeMultiplier = joystickSizeMultipliers[joystickSize] * viewportScale;
  const singleDriveJoystick = controlMode === 'single-drive-joystick';
  const arcadeDriving = controlMode === 'arcade-driving';
  const targetSpeedJoystick =
    arcadeDriving || controlMode === 'target-speed-joystick';
  const driveJoystick = singleDriveJoystick || targetSpeedJoystick;
  const cruiseTarget = useSyncExternalStore(
    (listener) => input.subscribe(listener),
    () => input.getMobileCruiseTarget(),
    () => input.getMobileCruiseTarget(),
  );
  const previousReversing = useRef(false);

  useEffect(() => {
    const updateViewportScale = () =>
      setViewportScale(controlViewportScale(window.innerHeight));
    window.addEventListener('resize', updateViewportScale);
    return () => window.removeEventListener('resize', updateViewportScale);
  }, []);

  useEffect(() => {
    if (useGameStore.getState().isJournalOpen) {
      input.suspendForOverlay();
      return;
    }
    const hasPreservedCruiseTarget =
      targetSpeedJoystick &&
      input.getMobileCruiseTarget().targetSpeedKilometersPerHour > 0;
    if (!hasPreservedCruiseTarget) input.clearAllInput();
    input.setMobileCruiseMode(
      arcadeDriving
        ? 'arcade'
        : targetSpeedJoystick
          ? 'target-speed'
          : 'off',
    );
  }, [arcadeDriving, controlMode, input, targetSpeedJoystick]);

  useEffect(
    () => () => {
      if (useGameStore.getState().isJournalOpen) {
        input.suspendForOverlay();
      } else {
        input.clearAllInput();
      }
    },
    [input],
  );

  useEffect(() => {
    input.clearPointerActions();
  }, [input, joystickDeadZone, joystickPositionMode, joystickSize]);

  useEffect(() => {
    if (controlsDisabled) input.clearAllInput();
  }, [controlsDisabled, input]);

  useEffect(() => {
    if (cruiseTarget.reversing && !previousReversing.current) {
      triggerHaptic('reverse', hapticsEnabled);
    }
    previousReversing.current = cruiseTarget.reversing;
  }, [cruiseTarget.reversing, hapticsEnabled]);

  return (
    <div
      className={`touch-controls touch-controls--${controlMode}`}
      aria-label="Controles táctiles"
      data-control-mode={controlMode}
      data-controls-disabled={String(controlsDisabled)}
      data-interaction-label={interactionLabel ?? undefined}
      onContextMenu={(event) => event.preventDefault()}
    >
      {controlMode === 'classic-buttons' ? (
        <ClassicTouchControls
          input={input}
          interactionLabel={interactionLabel}
          isPaused={isPaused}
          onCenter={() => setFollowingPlayer(true)}
          onTogglePause={togglePaused}
          hapticsEnabled={hapticsEnabled}
          controlsDisabled={controlsDisabled}
        />
      ) : (
        <>
          <VirtualJoystick
            key={controlsDisabled ? 'blocked' : 'active'}
            input={input}
            radiusPixels={virtualJoystickConfig.radiusPixels * sizeMultiplier}
            knobRadiusPixels={
              virtualJoystickConfig.knobRadiusPixels * sizeMultiplier
            }
            deadZone={joystickDeadZone}
            responseExponent={virtualJoystickConfig.responseExponent}
            returnDurationMilliseconds={
              virtualJoystickConfig.returnDurationMilliseconds
            }
            positionMode={joystickPositionMode}
            driveMode={driveJoystick}
            targetSpeedMode={targetSpeedJoystick}
            arcadeMode={arcadeDriving}
            speedMetersPerSecond={telemetry.speedMetersPerSecond}
            hapticsEnabled={hapticsEnabled}
            disabled={controlsDisabled}
          />
          {targetSpeedJoystick && (
            <output
              className={`mobile-cruise-target ${cruiseTarget.braking ? 'mobile-cruise-target--braking' : ''} ${cruiseTarget.reversing ? 'mobile-cruise-target--reversing' : ''}`}
              aria-live="polite"
              data-testid="mobile-cruise-target"
            >
              <span>
                {cruiseTarget.reversing
                  ? 'REVERSA'
                  : cruiseTarget.reverseState === 'awaiting-release'
                    ? 'SUELTA PARA REVERSA'
                    : cruiseTarget.reverseState === 'reverse-armed'
                      ? 'BAJA OTRA VEZ'
                  : cruiseTarget.braking
                    ? 'FRENANDO'
                    : cruiseGearLabels[cruiseTarget.selectedGear]}
              </span>
              {!cruiseTarget.reversing && (
                <strong>
                  OBJETIVO{' '}
                  {Math.round(cruiseTarget.targetSpeedKilometersPerHour)} km/h
                </strong>
              )}
            </output>
          )}
          <div className="touch-actions touch-actions--analog">
            <MobileActionButtons
              input={input}
              interactionLabel={interactionLabel}
              isPaused={isPaused}
              onCenter={() => setFollowingPlayer(true)}
              onTogglePause={togglePaused}
              controlsDisabled={controlsDisabled}
              autoThrottleAvailable={controlMode === 'joystick-auto-throttle'}
              hapticsEnabled={hapticsEnabled}
            />
            {!driveJoystick && (
              <MobilePedals
                input={input}
                showAccelerator={controlMode === 'joystick-pedals'}
                controlsDisabled={controlsDisabled}
                hapticsEnabled={hapticsEnabled}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function TouchControls({ input }: TouchControlsProps) {
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);

  useEffect(() => {
    if (isJournalOpen) input.suspendForOverlay();
    else input.resumeFromOverlay();
  }, [input, isJournalOpen]);

  return isJournalOpen ? null : <TouchControlsContent input={input} />;
}

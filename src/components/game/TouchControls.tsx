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
  const togglePaused = useGameStore((state) => state.togglePaused);
  const setFollowingPlayer = useGameStore((state) => state.setFollowingPlayer);
  const activeMissionId = useGameStore((state) => state.activeMissionId);
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
    interactionObjective &&
    objectiveRequiresManualInteraction(interactionObjective) &&
    nearestObjective.distanceMeters <= interactionObjective.radiusMeters
      ? interactionLabelForObjective(interactionObjective)
      : null;
  const sizeMultiplier = joystickSizeMultipliers[joystickSize] * viewportScale;
  const singleDriveJoystick = controlMode === 'single-drive-joystick';
  const targetSpeedJoystick = controlMode === 'target-speed-joystick';
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
    input.setMobileCruiseEnabled(targetSpeedJoystick);
  }, [controlMode, input, targetSpeedJoystick]);

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
    if (isPaused) input.clearAllInput();
  }, [input, isPaused]);

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
        />
      ) : (
        <>
          <VirtualJoystick
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
            speedMetersPerSecond={telemetry.speedMetersPerSecond}
            hapticsEnabled={hapticsEnabled}
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
              autoThrottleAvailable={controlMode === 'joystick-auto-throttle'}
              hapticsEnabled={hapticsEnabled}
            />
            {!driveJoystick && (
              <MobilePedals
                input={input}
                showAccelerator={controlMode === 'joystick-pedals'}
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
  }, [input, isJournalOpen]);

  return isJournalOpen ? null : <TouchControlsContent input={input} />;
}

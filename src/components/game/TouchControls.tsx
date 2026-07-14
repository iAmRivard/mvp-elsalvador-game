import { useEffect } from 'react';
import {
  joystickSizeMultipliers,
  virtualJoystickConfig,
} from '../../config/mobileControls.config';
import { missionById } from '../../data/missions';
import type { InputController } from '../../game/inputController';
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

const interactionLabels = {
  interact: 'Investigar',
  collect: 'Recoger',
  deliver: 'Entregar',
  repair: 'Reparar',
  refuel: 'Cargar',
  choice: 'Elegir',
} as const;

export function TouchControls({ input }: TouchControlsProps) {
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
    interactionObjective.type in interactionLabels &&
    nearestObjective.distanceMeters <= interactionObjective.radiusMeters
      ? interactionLabels[
          interactionObjective.type as keyof typeof interactionLabels
        ]
      : null;
  const sizeMultiplier = joystickSizeMultipliers[joystickSize];

  useEffect(() => {
    input.clearAllInput();
    return () => input.clearAllInput();
  }, [controlMode, input]);

  useEffect(() => {
    input.clearPointerActions();
  }, [input, joystickDeadZone, joystickPositionMode, joystickSize]);

  return (
    <div
      className={`touch-controls touch-controls--${controlMode}`}
      aria-label="Controles táctiles"
      data-control-mode={controlMode}
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
          />
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
            <MobilePedals
              input={input}
              showAccelerator={controlMode === 'joystick-pedals'}
              hapticsEnabled={hapticsEnabled}
            />
          </div>
        </>
      )}
    </div>
  );
}

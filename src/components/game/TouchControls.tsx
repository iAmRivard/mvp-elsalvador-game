import { virtualJoystickConfig } from '../../config/mobileControls.config';
import { missionById } from '../../data/missions';
import type { InputController } from '../../game/inputController';
import { objectiveIsAvailable } from '../../game/missions';
import { useGameStore } from '../../store/gameStore';
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
  const activeMission = activeMissionId
    ? missionById.get(activeMissionId)
    : null;
  const interactionObjective = activeMission?.objectives.find(
    (objective) =>
      objective.type in interactionLabels &&
      !completedObjectiveIds.includes(objective.id) &&
      objectiveIsAvailable(objective, completedObjectiveIds),
  );
  const interactionLabel = interactionObjective
    ? interactionLabels[
        interactionObjective.type as keyof typeof interactionLabels
      ]
    : null;
  const useClassicControls = false;

  return (
    <div
      className="touch-controls touch-controls--joystick-pedals"
      aria-label="Controles táctiles"
      onContextMenu={(event) => event.preventDefault()}
    >
      {useClassicControls ? (
        <ClassicTouchControls
          input={input}
          interactionLabel={interactionLabel}
          isPaused={isPaused}
          onCenter={() => setFollowingPlayer(true)}
          onTogglePause={togglePaused}
        />
      ) : (
        <>
          <VirtualJoystick
            input={input}
            radiusPixels={virtualJoystickConfig.radiusPixels}
            knobRadiusPixels={virtualJoystickConfig.knobRadiusPixels}
            deadZone={virtualJoystickConfig.deadZone}
            responseExponent={virtualJoystickConfig.responseExponent}
            returnDurationMilliseconds={
              virtualJoystickConfig.returnDurationMilliseconds
            }
            positionMode={virtualJoystickConfig.positionMode}
          />
          <div className="touch-actions touch-actions--analog">
            <MobileActionButtons
              input={input}
              interactionLabel={interactionLabel}
              isPaused={isPaused}
              onCenter={() => setFollowingPlayer(true)}
              onTogglePause={togglePaused}
            />
            <MobilePedals input={input} showAccelerator />
          </div>
        </>
      )}
    </div>
  );
}

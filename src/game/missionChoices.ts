import {
  missionById,
  type MissionChoiceOption,
  type MissionObjective,
} from '../data/missions';

export function missionChoiceOption(
  objective: MissionObjective,
  optionId: string,
): MissionChoiceOption | null {
  return (
    objective.choice?.options.find((option) => option.id === optionId) ?? null
  );
}

export function selectedMissionChoiceOption(
  missionId: string | null,
  selections: Readonly<Record<string, string>>,
): MissionChoiceOption | null {
  if (!missionId) return null;
  const mission = missionById.get(missionId);
  const optionId = selections[missionId];
  if (!mission || !optionId) return null;
  for (const objective of mission.objectives) {
    const option = missionChoiceOption(objective, optionId);
    if (option) return option;
  }
  return null;
}

export function missionChoiceConsequence(option: MissionChoiceOption): string {
  const fuel = option.fuelMultiplier ?? 1;
  const condition = option.conditionMultiplier ?? 1;
  if (fuel <= 1 && condition <= 1) {
    return `${option.label}: trayecto estable, con menor consumo y desgaste.`;
  }
  return `${option.label}: trayecto exigente, con mayor consumo y desgaste.`;
}

import { describe, expect, it } from 'vitest';
import type { Mission, MissionObjective } from '../src/data/missions';
import {
  advanceMissionObjectives,
  initialMissionObjectiveProgress,
} from '../src/game/missions';

function missionWith(objective: MissionObjective): Mission {
  return {
    id: `test-${objective.type}`,
    title: 'Misión de prueba',
    description: 'Valida un objetivo aislado.',
    startLocationId: 'san-salvador',
    destinationLocationId: 'san-salvador',
    objectives: [objective],
    rewards: [],
    prerequisites: [],
  };
}

const player = {
  longitude: -89.19,
  latitude: 13.69,
  fuel: 20,
};

const vehicle = {
  condition: 40,
  fuel: 20,
  maximumFuel: 100,
};

describe('tipos de objetivo v0.2', () => {
  it('recoge un objeto solamente mediante interacción', () => {
    const mission = missionWith({
      id: 'recoger-rele',
      type: 'collect',
      label: 'Recoger relé',
      coordinates: [player.longitude, player.latitude],
      radiusMeters: 50,
      itemId: 'rele-encendido',
      quantity: 1,
    });

    expect(
      advanceMissionObjectives(mission, [], player, false).isCompleted,
    ).toBe(false);
    const result = advanceMissionObjectives(mission, [], player, true);

    expect(result.isCompleted).toBe(true);
    expect(result.effects.addItems).toEqual([
      { itemId: 'rele-encendido', quantity: 1 },
    ]);
  });

  it('repara consumiendo la pieza y la energía requeridas', () => {
    const mission = missionWith({
      id: 'reparar-motor',
      type: 'repair',
      label: 'Reparar motor',
      coordinates: [player.longitude, player.latitude],
      radiusMeters: 50,
      requiredItemId: 'rele-encendido',
      repairAmount: 35,
      energyCost: 12,
    });
    const result = advanceMissionObjectives(mission, [], player, true, {
      inventory: [{ itemId: 'rele-encendido', quantity: 1 }],
      vehicle,
      energy: 20,
    });

    expect(result.isCompleted).toBe(true);
    expect(result.effects.consumeItems).toEqual([
      { itemId: 'rele-encendido', quantity: 1 },
    ]);
    expect(result.effects.conditionRestored).toBe(35);
    expect(result.effects.energyConsumed).toBe(12);
  });

  it('no repara sin pieza o sin energía suficiente', () => {
    const mission = missionWith({
      id: 'reparar-radio',
      type: 'repair',
      label: 'Reparar radio',
      radiusMeters: 50,
      requiredItemId: 'fusible-radio',
      energyCost: 10,
    });

    expect(
      advanceMissionObjectives(mission, [], player, true, {
        inventory: [],
        vehicle,
        energy: 50,
      }).isCompleted,
    ).toBe(false);
    expect(
      advanceMissionObjectives(mission, [], player, true, {
        inventory: [{ itemId: 'fusible-radio', quantity: 1 }],
        vehicle,
        energy: 5,
      }).isCompleted,
    ).toBe(false);
  });

  it('restaura combustible sin superar la capacidad', () => {
    const mission = missionWith({
      id: 'cargar-combustible',
      type: 'refuel',
      label: 'Cargar combustible',
      radiusMeters: 50,
      refuelAmount: 90,
    });
    const result = advanceMissionObjectives(mission, [], player, true, {
      vehicle,
    });

    expect(result.isCompleted).toBe(true);
    expect(result.effects.fuelRestored).toBe(80);
  });

  it('guarda el avance temporal, completa al llegar y falla al agotarse', () => {
    const mission = missionWith({
      id: 'llegar-a-tiempo',
      type: 'timed',
      label: 'Llegar antes de perder la señal',
      coordinates: [player.longitude, player.latitude],
      radiusMeters: 50,
      durationSeconds: 2,
    });
    const initialProgress = initialMissionObjectiveProgress(mission);
    const first = advanceMissionObjectives(
      mission,
      [],
      { ...player, longitude: -90 },
      false,
      { objectiveProgress: initialProgress, deltaTimeSeconds: 1 },
    );
    const completed = advanceMissionObjectives(mission, [], player, false, {
      objectiveProgress: first.objectiveProgress,
      deltaTimeSeconds: 0.5,
    });
    const failed = advanceMissionObjectives(
      mission,
      [],
      { ...player, longitude: -90 },
      false,
      { objectiveProgress: first.objectiveProgress, deltaTimeSeconds: 1 },
    );

    expect(first.objectiveProgress['llegar-a-tiempo'].elapsedSeconds).toBe(1);
    expect(completed.isCompleted).toBe(true);
    expect(failed.failedObjectiveId).toBe('llegar-a-tiempo');
    expect(failed.isCompleted).toBe(false);
  });
});

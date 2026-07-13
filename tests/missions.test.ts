import { describe, expect, it } from 'vitest';
import { missionById, missions } from '../src/data/missions';
import {
  advanceMissionObjectives,
  missionStartBlockReason,
  nearestPendingObjective,
  summarizeMissionRewards,
} from '../src/game/missions';

const sanSalvador: [number, number] = [-89.191111, 13.6975];
const santaAna: [number, number] = [-89.556667, 13.994722];

describe('misiones iniciales', () => {
  it('define las tres misiones requeridas fuera de los componentes', () => {
    expect(missions).toHaveLength(3);
    expect(missions.map((mission) => mission.title)).toEqual([
      'Camino hacia Santa Ana',
      'El secreto de Coatepeque',
      'Señales en Suchitoto',
    ]);
  });

  it('valida el lugar inicial y los prerrequisitos', () => {
    const first = missionById.get('camino-hacia-santa-ana')!;
    const second = missionById.get('secreto-de-coatepeque')!;

    expect(missionStartBlockReason(first, [], sanSalvador)).toBeNull();
    expect(missionStartBlockReason(first, [], santaAna)).toBe('wrong-location');
    expect(missionStartBlockReason(second, [], santaAna)).toBe('prerequisite');
    expect(
      missionStartBlockReason(second, ['camino-hacia-santa-ana'], santaAna),
    ).toBeNull();
  });

  it('completa el viaje a Santa Ana solamente si queda combustible', () => {
    const mission = missionById.get('camino-hacia-santa-ana')!;
    const withoutFuel = advanceMissionObjectives(
      mission,
      [],
      { longitude: santaAna[0], latitude: santaAna[1], fuel: 0 },
      false,
    );
    const withFuel = advanceMissionObjectives(
      mission,
      [],
      { longitude: santaAna[0], latitude: santaAna[1], fuel: 12 },
      false,
    );

    expect(withoutFuel.isCompleted).toBe(false);
    expect(withFuel.isCompleted).toBe(true);
    expect(withFuel.completedObjectiveIds).toEqual(['llegar-a-santa-ana']);
  });

  it('registra por separado los tres puntos alrededor de Coatepeque', () => {
    const mission = missionById.get('secreto-de-coatepeque')!;
    let completed: string[] = [];

    for (const objective of mission.objectives) {
      const [longitude, latitude] = objective.coordinates!;
      completed = advanceMissionObjectives(
        mission,
        completed,
        { longitude, latitude, fuel: 50 },
        false,
      ).completedObjectiveIds;
    }

    expect(completed).toEqual(['mirador-norte', 'ribera-este', 'ribera-sur']);
    expect(
      nearestPendingObjective(mission, completed, [-89.546389, 13.863611]),
    ).toBeNull();
  });

  it('exige una interacción para investigar la señal de Suchitoto', () => {
    const mission = missionById.get('senales-en-suchitoto')!;
    const [longitude, latitude] = [-89.025833, 13.936667];

    expect(
      advanceMissionObjectives(
        mission,
        [],
        { longitude, latitude, fuel: 50 },
        false,
      ).isCompleted,
    ).toBe(false);
    expect(
      advanceMissionObjectives(
        mission,
        [],
        { longitude, latitude, fuel: 50 },
        true,
      ).isCompleted,
    ).toBe(true);
  });

  it('resume recompensas de progreso, recursos y desbloqueos', () => {
    const mission = missionById.get('camino-hacia-santa-ana')!;
    expect(summarizeMissionRewards(mission.rewards)).toEqual({
      experience: 250,
      fuel: 30,
      energy: 0,
      unlockedLocationIds: ['volcan-santa-ana'],
      itemIds: [],
      storyIds: [],
    });
  });
});

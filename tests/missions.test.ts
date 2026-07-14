import { describe, expect, it } from 'vitest';
import {
  chapterOneMissionIds,
  CHAPTER_ONE_TITLE,
  narrativeEvents,
} from '../src/data/chapter1';
import { missionById, missions } from '../src/data/missions';
import {
  advanceMissionObjectives,
  missionStartBlockReason,
  nearestPendingObjective,
  summarizeMissionRewards,
} from '../src/game/missions';

const sanSalvador: [number, number] = [-89.191111, 13.6975];
const santaAna: [number, number] = [-89.556667, 13.994722];

describe(CHAPTER_ONE_TITLE, () => {
  it('define seis misiones conectadas y conserva Suchitoto como contenido opcional', () => {
    expect(missions).toHaveLength(7);
    expect(chapterOneMissionIds).toHaveLength(6);
    expect(
      chapterOneMissionIds.map((id) => missionById.get(id)?.title),
    ).toEqual([
      'La transmisión',
      'Camino bloqueado',
      'Estación abandonada',
      'Reparación de emergencia',
      'Llegada a Santa Ana',
      'Ecos de Coatepeque',
    ]);
    chapterOneMissionIds.forEach((missionId, index) => {
      expect(missionById.get(missionId)?.prerequisites).toEqual(
        index === 0 ? [] : [chapterOneMissionIds[index - 1]],
      );
    });
    expect(missionById.has('senales-en-suchitoto')).toBe(true);
  });

  it('valida el lugar inicial y los prerrequisitos del capítulo', () => {
    const first = missionById.get('la-transmision')!;
    const second = missionById.get('camino-hacia-santa-ana')!;

    expect(missionStartBlockReason(first, [], sanSalvador)).toBeNull();
    expect(missionStartBlockReason(first, [], santaAna)).toBe('wrong-location');
    expect(missionStartBlockReason(second, [], sanSalvador)).toBe(
      'prerequisite',
    );
    expect(
      missionStartBlockReason(
        second,
        ['la-transmision'],
        [-89.3175451, 13.6820687],
      ),
    ).toBeNull();
  });

  it('no activa el objetivo con tiempo antes de elegir el desvío', () => {
    const mission = missionById.get('camino-hacia-santa-ana')!;
    const result = advanceMissionObjectives(
      mission,
      ['llegar-al-bloqueo'],
      { longitude: -89.3592277, latitude: 13.7305749, fuel: 60 },
      false,
      { deltaTimeSeconds: 30 },
    );

    expect(
      result.objectiveProgress['alcanzar-estacion-a-tiempo'].elapsedSeconds,
    ).toBe(0);
    expect(
      nearestPendingObjective(
        mission,
        ['llegar-al-bloqueo'],
        [-89.3592277, 13.7305749],
      )?.objective.id,
    ).toBe('inspeccionar-bloqueo');
  });

  it('completa la llegada a Santa Ana solamente con combustible e interacción', () => {
    const mission = missionById.get('llegada-a-santa-ana')!;
    const withoutFuel = advanceMissionObjectives(
      mission,
      [],
      { longitude: santaAna[0], latitude: santaAna[1], fuel: 0 },
      false,
    );
    const arrival = advanceMissionObjectives(
      mission,
      [],
      { longitude: santaAna[0], latitude: santaAna[1], fuel: 12 },
      false,
    );
    const completed = advanceMissionObjectives(
      mission,
      arrival.completedObjectiveIds,
      { longitude: -89.556959, latitude: 13.994583, fuel: 12 },
      true,
      { objectiveProgress: arrival.objectiveProgress },
    );

    expect(withoutFuel.isCompleted).toBe(false);
    expect(arrival.completedObjectiveIds).toEqual(['llegar-a-santa-ana']);
    expect(completed.isCompleted).toBe(true);
  });

  it('registra tres accesos de Coatepeque antes de habilitar la baliza', () => {
    const mission = missionById.get('secreto-de-coatepeque')!;
    let completed: string[] = [];
    let objectiveProgress = {};

    for (const objective of mission.objectives.slice(0, 4)) {
      const coordinates = objective.coordinates!;
      const result = advanceMissionObjectives(
        mission,
        completed,
        { longitude: coordinates[0], latitude: coordinates[1], fuel: 50 },
        false,
        { objectiveProgress },
      );
      completed = result.completedObjectiveIds;
      objectiveProgress = result.objectiveProgress;
    }

    expect(completed).toEqual([
      'llegar-a-coatepeque',
      'mirador-norte',
      'ribera-este',
      'ribera-sur',
    ]);
    const beacon = nearestPendingObjective(
      mission,
      completed,
      [-89.5741276, 13.9043351],
    );
    expect(beacon?.objective.id).toBe('investigar-baliza-coatepeque');
    expect(
      advanceMissionObjectives(
        mission,
        completed,
        {
          longitude: beacon!.coordinates[0],
          latitude: beacon!.coordinates[1],
          fuel: 50,
        },
        true,
        { objectiveProgress },
      ).isCompleted,
    ).toBe(true);
  });

  it('resume recompensas de Santa Ana y el desbloqueo de Coatepeque', () => {
    const mission = missionById.get('llegada-a-santa-ana')!;
    expect(summarizeMissionRewards(mission.rewards)).toEqual({
      experience: 320,
      fuel: 25,
      energy: 0,
      unlockedLocationIds: ['lago-coatepeque'],
      itemIds: [],
      storyIds: ['fuente-parcial-santa-ana'],
    });
  });

  it('mantiene la interacción de la misión opcional de Suchitoto', () => {
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

  it('cada evento narrativo explica el objetivo y su presentación', () => {
    for (const event of narrativeEvents) {
      expect(['radio', 'modal', 'chapter']).toContain(event.presentation);
      expect(event.channelLabel.length).toBeGreaterThan(0);
      expect(event.objectiveSummary?.length).toBeGreaterThan(0);
    }
  });
});

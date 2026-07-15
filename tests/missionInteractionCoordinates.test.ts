import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { Mission, MissionObjective } from '../src/data/missions';
import {
  advanceMissionObjectives,
  isInsideValidObjectiveZone,
  nearestPendingObjective,
  objectiveCoordinates,
  objectiveNarrativeCoordinates,
} from '../src/game/missions';

const objective: MissionObjective = {
  id: 'senal-fuera-de-la-via',
  type: 'interact',
  label: 'Investiga la seÃ±al',
  coordinates: [-89.3, 13.7],
  interactionCoordinates: [-89.299, 13.701],
  radiusMeters: 50,
};

const mission: Mission = {
  id: 'mission-test',
  title: 'Prueba',
  description: 'Prueba un punto narrativo separado.',
  startLocationId: 'san-salvador',
  destinationLocationId: 'san-salvador',
  objectives: [objective],
  rewards: [],
  prerequisites: [],
  completionSummary: 'Completado.',
};

describe('coordenadas de interacciÃ³n de objetivos', () => {
  it('conserva el marcador narrativo pero enruta y completa en el punto jugable', () => {
    expect(objectiveNarrativeCoordinates(objective)).toEqual([-89.3, 13.7]);
    expect(objectiveCoordinates(objective)).toEqual([-89.299, 13.701]);
    expect(
      nearestPendingObjective(mission, [], [-89.299, 13.701])?.coordinates,
    ).toEqual([-89.299, 13.701]);
    expect(
      advanceMissionObjectives(
        mission,
        [],
        { longitude: -89.3, latitude: 13.7, fuel: 50 },
        true,
      ).isCompleted,
    ).toBe(false);
    expect(
      advanceMissionObjectives(
        mission,
        [],
        { longitude: -89.299, latitude: 13.701, fuel: 50 },
        true,
      ).isCompleted,
    ).toBe(true);
  });

  it('exige radio, contacto vial y edge esperado para la etiqueta visual', () => {
    const roadContext = {
      nearestRoadEdgeId: 42,
      distanceToNearestRoadMeters: 3,
      expectedRoadEdgeIds: new Set([42]),
      maximumRoadDistanceMeters: 70,
      directRoadContactToleranceMeters: 8,
    };
    expect(
      isInsideValidObjectiveZone(objective, [-89.299, 13.701], roadContext),
    ).toBe(true);
    expect(
      isInsideValidObjectiveZone(objective, [-89.299, 13.701], {
        ...roadContext,
        distanceToNearestRoadMeters: 20,
        expectedRoadEdgeIds: new Set([99]),
      }),
    ).toBe(false);
    expect(
      isInsideValidObjectiveZone(objective, [-89.3, 13.7], roadContext),
    ).toBe(false);
  });

  it('valida todos los objetivos reales contra el snapshot vial', () => {
    const output = execFileSync(
      process.execPath,
      ['scripts/roads/validate-mission-objectives.mjs'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    const validations = JSON.parse(output) as Array<{
      missionId: string;
      objectiveId: string;
      coordinates: [number, number];
      nearestRoadEdgeId: number | null;
      distanceToNearestRoadMeters: number | null;
      interactionRadiusMeters: number;
      explicitlyOffroad: boolean;
      reachableFromRoad: boolean;
    }>;
    expect(validations).toHaveLength(20);
    expect(
      validations.every((validation) => validation.reachableFromRoad),
    ).toBe(true);
    expect(
      validations.find(
        (validation) => validation.objectiveId === 'recoger-rele',
      ),
    ).toMatchObject({
      nearestRoadEdgeId: 16285,
      reachableFromRoad: true,
      explicitlyOffroad: false,
    });
    expect(
      validations.filter((validation) => validation.explicitlyOffroad),
    ).toHaveLength(1);
  });
});

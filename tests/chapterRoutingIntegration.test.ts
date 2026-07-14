/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { missionById } from '../src/data/missions';
import { restrictedAreaTypeAt } from '../src/data/restrictedAreas';
import { objectiveCoordinates } from '../src/game/missions';
import { parseRoadNetwork } from '../src/roads/roadNetwork';
import { AStarRouter } from '../src/roads/routingService';
import { RoadSpatialIndex } from '../src/roads/spatialIndex';
import type { RoadCoordinates } from '../src/types/roads';

async function chapterRouter() {
  const serialized = await readFile(
    'public/data/roads/western-corridor.json',
    'utf8',
  );
  const network = parseRoadNetwork(JSON.parse(serialized) as unknown);
  return new AStarRouter(network, new RoadSpatialIndex(network));
}

describe('rutas del Capítulo 1', () => {
  it('conecta los tramos largos del capítulo sobre la red local', async () => {
    const router = await chapterRouter();
    const legs: [RoadCoordinates, RoadCoordinates][] = [
      [
        [-89.1908911, 13.6962937],
        [-89.3175451, 13.6820687],
      ],
      [
        [-89.3175451, 13.6820687],
        [-89.3592277, 13.7305749],
      ],
      [
        [-89.3981679, 13.7673945],
        [-89.447361, 13.8408999],
      ],
      [
        [-89.447361, 13.8408999],
        [-89.556959, 13.994583],
      ],
      [
        [-89.556959, 13.994583],
        [-89.5542247, 13.9059141],
      ],
      [
        [-89.5542247, 13.9059141],
        [-89.5082783, 13.8722307],
      ],
      [
        [-89.5082783, 13.8722307],
        [-89.5512194, 13.8294224],
      ],
      [
        [-89.5512194, 13.8294224],
        [-89.5741276, 13.9043351],
      ],
    ];

    let totalDurationSeconds = 0;
    for (const [origin, destination] of legs) {
      const route = router.getRoute({ origin, destination });
      expect(route).not.toBeNull();
      expect(route!.coordinates.length).toBeGreaterThan(2);
      if (origin[1] < 13.93 && destination[1] < 13.93) {
        const waterCoordinates = route!.coordinates.filter(
          (coordinates) => restrictedAreaTypeAt(coordinates) === 'water',
        );
        expect(
          waterCoordinates,
          `${origin.join(',')} -> ${destination.join(',')}`,
        ).toEqual([]);
      }
      totalDurationSeconds += route!.estimatedGameDurationSeconds;
    }
    expect(totalDurationSeconds).toBeGreaterThan(12 * 60);
    expect(totalDurationSeconds).toBeLessThan(25 * 60);
  });

  it('encuentra una salida al cerrar el tramo principal', async () => {
    const router = await chapterRouter();
    const closedEdgeIds = [14_072];
    const request = {
      origin: [-89.3592277, 13.7305749] as RoadCoordinates,
      destination: [-89.3981679, 13.7673945] as RoadCoordinates,
    };
    const normalRoute = router.getRoute(request)!;
    const alternative = router.getRoute({
      ...request,
      temporarilyClosedEdgeIds: closedEdgeIds,
    });

    expect(normalRoute.edgeIds).toContain(closedEdgeIds[0]);
    expect(alternative).not.toBeNull();
    expect(alternative!.edgeIds).not.toContain(closedEdgeIds[0]);
    expect(alternative!.distanceMeters).toBeGreaterThan(
      normalRoute.distanceMeters,
    );
  });

  it('cada elección de Camino bloqueado produce una ruta A* distinta', async () => {
    const router = await chapterRouter();
    const objective = missionById
      .get('camino-hacia-santa-ana')!
      .objectives.find((candidate) => candidate.type === 'choice')!;
    const north = objective.choice!.options.find(
      (option) => option.id === 'north',
    )!;
    const south = objective.choice!.options.find(
      (option) => option.id === 'south',
    )!;
    const request = {
      origin: [-89.3592277, 13.7305749] as RoadCoordinates,
      destination: [-89.447361, 13.8408999] as RoadCoordinates,
    };
    const northRoute = router.getRoute({
      ...request,
      temporarilyClosedEdgeIds: north.closedRoadEdgeIds,
    });
    const southRoute = router.getRoute({
      ...request,
      temporarilyClosedEdgeIds: south.closedRoadEdgeIds,
    });

    expect(northRoute).not.toBeNull();
    expect(southRoute).not.toBeNull();
    expect(northRoute!.edgeIds).not.toEqual(southRoute!.edgeIds);
    expect(northRoute!.distanceMeters).toBeGreaterThan(
      southRoute!.distanceMeters,
    );
    expect(north.fuelMultiplier).not.toBe(south.fuelMultiplier);
    expect(north.conditionMultiplier).not.toBe(south.conditionMultiplier);
  });

  it('mantiene los objetivos de Coatepeque fuera de la máscara de agua', () => {
    const mission = missionById.get('secreto-de-coatepeque')!;
    for (const objective of mission.objectives) {
      const coordinates = objectiveCoordinates(objective)!;
      expect(restrictedAreaTypeAt(coordinates)).toBeNull();
    }
  });
});

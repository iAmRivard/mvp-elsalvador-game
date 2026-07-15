import { readFile } from 'node:fs/promises';
import { locations } from '../../src/data/locations.ts';
import { missions } from '../../src/data/missions.ts';

const NETWORK_PATH = 'public/data/roads/western-corridor.json';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function validCoordinates(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((coordinate) => Number.isFinite(coordinate)) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function projectOntoSegment(position, start, end) {
  const latitudeRadians = (position[1] * Math.PI) / 180;
  const longitudeScale = 111_320 * Math.cos(latitudeRadians);
  const latitudeScale = 111_132;
  const endX = (end[0] - start[0]) * longitudeScale;
  const endY = (end[1] - start[1]) * latitudeScale;
  const positionX = (position[0] - start[0]) * longitudeScale;
  const positionY = (position[1] - start[1]) * latitudeScale;
  const segmentLengthSquared = endX * endX + endY * endY;
  const progress =
    segmentLengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            (positionX * endX + positionY * endY) / segmentLengthSquared,
          ),
        );
  return {
    coordinates: [
      start[0] + (end[0] - start[0]) * progress,
      start[1] + (end[1] - start[1]) * progress,
    ],
    distanceMeters: Math.hypot(
      positionX - endX * progress,
      positionY - endY * progress,
    ),
  };
}

function nearestRoad(network, coordinates) {
  let nearest = null;
  for (const edge of network.edges) {
    for (let index = 1; index < edge.coordinates.length; index += 1) {
      const projection = projectOntoSegment(
        coordinates,
        edge.coordinates[index - 1],
        edge.coordinates[index],
      );
      if (!nearest || projection.distanceMeters < nearest.distanceMeters) {
        nearest = {
          edgeId: edge.id,
          coordinates: projection.coordinates,
          distanceMeters: projection.distanceMeters,
        };
      }
    }
  }
  return nearest;
}

const network = JSON.parse(await readFile(NETWORK_PATH, 'utf8'));
invariant(Array.isArray(network.edges), 'La red vial no contiene aristas.');
const locationsById = new Map(
  locations.map((location) => [location.id, location]),
);
const validations = [];

for (const mission of missions) {
  for (const objective of mission.objectives) {
    const narrativeCoordinates =
      objective.coordinates ??
      locationsById.get(objective.targetLocationId)?.coordinates ??
      null;
    invariant(
      validCoordinates(narrativeCoordinates),
      `${mission.id}/${objective.id}: faltan coordenadas narrativas validas.`,
    );
    invariant(
      objective.interactionCoordinates === undefined ||
        validCoordinates(objective.interactionCoordinates),
      `${mission.id}/${objective.id}: interactionCoordinates no son validas.`,
    );
    invariant(
      Number.isFinite(objective.radiusMeters) && objective.radiusMeters > 0,
      `${mission.id}/${objective.id}: radio de interaccion invalido.`,
    );

    const activationCoordinates =
      objective.interactionCoordinates ?? narrativeCoordinates;
    const nearest = nearestRoad(network, activationCoordinates);
    const explicitlyOffroad = objective.explicitlyOffroad === true;
    const reachableFromRoad =
      explicitlyOffroad ||
      (nearest !== null && nearest.distanceMeters <= objective.radiusMeters);
    validations.push({
      missionId: mission.id,
      objectiveId: objective.id,
      coordinates: narrativeCoordinates,
      nearestRoadEdgeId: nearest?.edgeId ?? null,
      distanceToNearestRoadMeters: nearest?.distanceMeters ?? null,
      interactionRadiusMeters: objective.radiusMeters,
      explicitlyOffroad,
      reachableFromRoad,
    });
  }
}

console.log(JSON.stringify(validations, null, 2));
const unreachable = validations.filter(
  (validation) => !validation.reachableFromRoad,
);
invariant(
  unreachable.length === 0,
  `Objetivos normales inalcanzables desde la red vial: ${unreachable
    .map((validation) => `${validation.missionId}/${validation.objectiveId}`)
    .join(', ')}.`,
);
console.error(
  `Objetivos viales validos: ${validations.length}; excepciones offroad: ${validations.filter((validation) => validation.explicitlyOffroad).length}.`,
);

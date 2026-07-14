import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const SOURCE_DATE = '260712';
const GENERATED_AT = '2026-07-14T21:00:00.000Z';
const SOURCE_ID = `geofabrik-el-salvador-${SOURCE_DATE}`;
const BOUNDS = [-89.72, 13.58, -89.05, 14.08];
const SIMPLIFICATION_TOLERANCE_METERS = 2.5;
const CACHE_DIR = resolve(process.env.ROAD_CACHE_DIR ?? '.cache/roads');
const SOURCE = resolve(
  process.env.ROAD_SOURCE ?? `${CACHE_DIR}/el-salvador-${SOURCE_DATE}.osm.pbf`,
);
const EXTRACT = resolve(`${CACHE_DIR}/western-corridor.extract.osm.pbf`);
const FILTERED = resolve(`${CACHE_DIR}/western-corridor.roads.osm.pbf`);
const GEOJSON = resolve(`${CACHE_DIR}/western-corridor.roads.geojson`);
const OUTPUT = resolve(
  process.env.ROAD_OUTPUT ?? 'public/data/roads/western-corridor.json',
);
const CHECKSUM_OUTPUT = resolve('data/road-checksums.txt');

const ROAD_CLASSES = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'service',
  'track',
];

const SPEED_MULTIPLIERS = {
  motorway: 1.25,
  trunk: 1.15,
  primary: 1,
  secondary: 0.9,
  tertiary: 0.8,
  residential: 0.65,
  service: 0.55,
  track: 0.5,
};

const UNPAVED_SURFACES = new Set([
  'unpaved',
  'compacted',
  'fine_gravel',
  'gravel',
  'pebblestone',
  'ground',
  'dirt',
  'earth',
  'grass',
  'sand',
  'mud',
]);

const CORRIDOR_PATH = [
  [-89.1911, 13.6989],
  [-89.2886, 13.6769],
  [-89.4696, 13.7449],
  [-89.5598, 13.9942],
  [-89.545, 13.8802],
  [-89.6237, 13.8275],
];

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error?.code === 'ENOENT') {
    throw new Error(
      `No se encontro ${command}. Instala osmium-tool antes de generar la red vial.`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`${command} termino con codigo ${String(result.status)}.`);
  }
}

function roadClassFor(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.endsWith('_link') ? value.slice(0, -5) : value;
  return ROAD_CLASSES.includes(normalized) ? normalized : null;
}

function surfaceFor(properties, roadClass) {
  const surface = String(properties.surface ?? '').toLowerCase();
  return roadClass === 'track' || UNPAVED_SURFACES.has(surface)
    ? 'dirt-road'
    : roadClass;
}

function coordinateKey([longitude, latitude]) {
  return `${longitude.toFixed(7)},${latitude.toFixed(7)}`;
}

function cleanCoordinates(coordinates) {
  const result = [];
  for (const coordinate of coordinates) {
    if (
      !Array.isArray(coordinate) ||
      coordinate.length < 2 ||
      !Number.isFinite(coordinate[0]) ||
      !Number.isFinite(coordinate[1])
    ) {
      continue;
    }
    const normalized = [
      Number(coordinate[0].toFixed(7)),
      Number(coordinate[1].toFixed(7)),
    ];
    if (
      coordinateKey(result.at(-1) ?? [Infinity, Infinity]) !==
      coordinateKey(normalized)
    ) {
      result.push(normalized);
    }
  }
  return result;
}

function distanceMeters(a, b) {
  const radians = Math.PI / 180;
  const latitude1 = a[1] * radians;
  const latitude2 = b[1] * radians;
  const deltaLatitude = (b[1] - a[1]) * radians;
  const deltaLongitude = (b[0] - a[0]) * radians;
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) ** 2;
  return (
    6_371_008.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function pointSegmentDistanceMeters(point, start, end) {
  const latitudeRadians = (point[1] * Math.PI) / 180;
  const longitudeScale = 111_320 * Math.cos(latitudeRadians);
  const latitudeScale = 111_132;
  const startX = (start[0] - point[0]) * longitudeScale;
  const startY = (start[1] - point[1]) * latitudeScale;
  const endX = (end[0] - point[0]) * longitudeScale;
  const endY = (end[1] - point[1]) * latitudeScale;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const progress =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared),
        );
  return Math.hypot(startX + progress * deltaX, startY + progress * deltaY);
}

function distanceToCorridorMeters(coordinate) {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < CORRIDOR_PATH.length; index += 1) {
    nearest = Math.min(
      nearest,
      pointSegmentDistanceMeters(
        coordinate,
        CORRIDOR_PATH[index - 1],
        CORRIDOR_PATH[index],
      ),
    );
  }
  return nearest;
}

function distanceToHubMeters(coordinate, hubs = CORRIDOR_PATH) {
  return Math.min(...hubs.map((hub) => distanceMeters(coordinate, hub)));
}

function isInsideCorridor(coordinates, roadClass) {
  return coordinates.some((coordinate) => {
    const corridorDistance = distanceToCorridorMeters(coordinate);
    const hubDistance = distanceToHubMeters(coordinate);
    if (['motorway', 'trunk', 'primary', 'secondary'].includes(roadClass)) {
      return corridorDistance <= 14_000;
    }
    if (roadClass === 'tertiary') return corridorDistance <= 9_000;
    if (roadClass === 'residential') {
      return corridorDistance <= 2_000 || hubDistance <= 3_000;
    }
    if (roadClass === 'service') {
      return corridorDistance <= 1_200 || hubDistance <= 2_000;
    }
    if (roadClass === 'track') {
      const westernHubs = CORRIDOR_PATH.slice(-2);
      return (
        corridorDistance <= 2_000 ||
        distanceToHubMeters(coordinate, westernHubs) <= 4_000
      );
    }
    return false;
  });
}

function perpendicularDistanceMeters(point, start, end) {
  return pointSegmentDistanceMeters(point, start, end);
}

function simplifyCoordinates(coordinates, toleranceMeters) {
  if (coordinates.length <= 2) return coordinates;
  let farthestDistance = 0;
  let farthestIndex = 0;
  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const distance = perpendicularDistanceMeters(
      coordinates[index],
      coordinates[0],
      coordinates.at(-1),
    );
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestIndex = index;
    }
  }
  if (farthestDistance <= toleranceMeters) {
    return [coordinates[0], coordinates.at(-1)];
  }
  const left = simplifyCoordinates(
    coordinates.slice(0, farthestIndex + 1),
    toleranceMeters,
  );
  const right = simplifyCoordinates(
    coordinates.slice(farthestIndex),
    toleranceMeters,
  );
  return [...left.slice(0, -1), ...right];
}

function lineDistanceMeters(coordinates) {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += distanceMeters(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

function featureLines(feature) {
  if (feature.geometry?.type === 'LineString')
    return [feature.geometry.coordinates];
  if (feature.geometry?.type === 'MultiLineString')
    return feature.geometry.coordinates;
  return [];
}

function isDriveable(properties) {
  const denied = new Set(['no', 'private']);
  return (
    properties.area !== 'yes' &&
    !denied.has(properties.access) &&
    !denied.has(properties.vehicle) &&
    !denied.has(properties.motor_vehicle)
  );
}

function mergeCompatibleEdges(edgeDrafts) {
  const adjacency = new Map();
  const addAdjacentEdge = (nodeKey, edgeIndex) => {
    const edgeIndexes = adjacency.get(nodeKey) ?? [];
    edgeIndexes.push(edgeIndex);
    adjacency.set(nodeKey, edgeIndexes);
  };
  edgeDrafts.forEach((edge, edgeIndex) => {
    addAdjacentEdge(edge.fromKey, edgeIndex);
    addAdjacentEdge(edge.toKey, edgeIndex);
  });

  const isMergePoint = (nodeKey) => {
    const indexes = adjacency.get(nodeKey) ?? [];
    if (indexes.length !== 2) return false;
    const first = edgeDrafts[indexes[0]];
    const second = edgeDrafts[indexes[1]];
    if (
      first.roadClass !== second.roadClass ||
      first.surface !== second.surface ||
      first.oneWay !== second.oneWay
    )
      return false;
    if (!first.oneWay) return true;
    const incoming =
      Number(first.toKey === nodeKey) + Number(second.toKey === nodeKey);
    const outgoing =
      Number(first.fromKey === nodeKey) + Number(second.fromKey === nodeKey);
    return incoming === 1 && outgoing === 1;
  };

  const visited = new Set();
  const merged = [];
  const orderedIndexes = edgeDrafts
    .map((edge, edgeIndex) => ({ edge, edgeIndex }))
    .sort((a, b) => {
      const aStartsAtBoundary = !isMergePoint(a.edge.fromKey) ? 0 : 1;
      const bStartsAtBoundary = !isMergePoint(b.edge.fromKey) ? 0 : 1;
      return aStartsAtBoundary - bStartsAtBoundary || a.edgeIndex - b.edgeIndex;
    })
    .map(({ edgeIndex }) => edgeIndex);

  for (const initialIndex of orderedIndexes) {
    if (visited.has(initialIndex)) continue;
    const initial = edgeDrafts[initialIndex];
    let currentNode = initial.fromKey;
    if (
      !initial.oneWay &&
      isMergePoint(initial.fromKey) &&
      !isMergePoint(initial.toKey)
    ) {
      currentNode = initial.toKey;
    }
    const fromKey = currentNode;
    const coordinates = [];
    let currentIndex = initialIndex;

    while (!visited.has(currentIndex)) {
      const edge = edgeDrafts[currentIndex];
      let orientedCoordinates;
      let nextNode;
      if (edge.fromKey === currentNode) {
        orientedCoordinates = edge.coordinates;
        nextNode = edge.toKey;
      } else if (!edge.oneWay && edge.toKey === currentNode) {
        orientedCoordinates = [...edge.coordinates].reverse();
        nextNode = edge.fromKey;
      } else {
        break;
      }
      visited.add(currentIndex);
      coordinates.push(
        ...(coordinates.length === 0
          ? orientedCoordinates
          : orientedCoordinates.slice(1)),
      );
      currentNode = nextNode;
      if (!isMergePoint(currentNode) || currentNode === fromKey) break;

      const nextIndex = (adjacency.get(currentNode) ?? []).find(
        (candidateIndex) => {
          if (visited.has(candidateIndex)) return false;
          const candidate = edgeDrafts[candidateIndex];
          return (
            candidate.roadClass === initial.roadClass &&
            candidate.surface === initial.surface &&
            candidate.oneWay === initial.oneWay &&
            (candidate.fromKey === currentNode ||
              (!candidate.oneWay && candidate.toKey === currentNode))
          );
        },
      );
      if (nextIndex === undefined) break;
      currentIndex = nextIndex;
    }

    if (coordinates.length >= 2 && fromKey !== currentNode) {
      merged.push({
        fromKey,
        toKey: currentNode,
        coordinates: simplifyCoordinates(
          coordinates,
          SIMPLIFICATION_TOLERANCE_METERS,
        ),
        roadClass: initial.roadClass,
        surface: initial.surface,
        oneWay: initial.oneWay,
      });
    }
  }
  return merged;
}

function keepLargestConnectedComponent(edgeDrafts) {
  const adjacency = new Map();
  const connect = (from, to) => {
    const neighbors = adjacency.get(from) ?? new Set();
    neighbors.add(to);
    adjacency.set(from, neighbors);
  };
  for (const edge of edgeDrafts) {
    connect(edge.fromKey, edge.toKey);
    connect(edge.toKey, edge.fromKey);
  }

  const visited = new Set();
  let largest = new Set();
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const component = new Set([start]);
    const queue = [start];
    visited.add(start);
    for (let index = 0; index < queue.length; index += 1) {
      for (const neighbor of adjacency.get(queue[index]) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        component.add(neighbor);
        queue.push(neighbor);
      }
    }
    if (component.size > largest.size) largest = component;
  }
  return edgeDrafts.filter(
    (edge) => largest.has(edge.fromKey) && largest.has(edge.toKey),
  );
}

function buildNetwork(collection) {
  const lines = [];
  for (const feature of collection.features ?? []) {
    const properties = feature.properties ?? {};
    const roadClass = roadClassFor(properties.highway);
    if (!roadClass || !isDriveable(properties)) continue;
    for (const rawCoordinates of featureLines(feature)) {
      let coordinates = cleanCoordinates(rawCoordinates);
      if (coordinates.length < 2 || !isInsideCorridor(coordinates, roadClass))
        continue;
      const oneWayValue = String(properties.oneway ?? '').toLowerCase();
      const oneWay = ['yes', '1', 'true', '-1'].includes(oneWayValue);
      if (oneWayValue === '-1') coordinates = [...coordinates].reverse();
      lines.push({
        coordinates,
        roadClass,
        surface: surfaceFor(properties, roadClass),
        oneWay,
      });
    }
  }

  const neighbors = new Map();
  const addNeighbor = (key, neighbor) => {
    const values = neighbors.get(key) ?? new Set();
    values.add(neighbor);
    neighbors.set(key, values);
  };
  for (const line of lines) {
    for (let index = 1; index < line.coordinates.length; index += 1) {
      const previous = coordinateKey(line.coordinates[index - 1]);
      const current = coordinateKey(line.coordinates[index]);
      addNeighbor(previous, current);
      addNeighbor(current, previous);
    }
  }

  const edgeDrafts = [];
  for (const line of lines) {
    let startIndex = 0;
    for (let index = 1; index < line.coordinates.length; index += 1) {
      const key = coordinateKey(line.coordinates[index]);
      const isEndpoint = index === line.coordinates.length - 1;
      const isJunction = (neighbors.get(key)?.size ?? 0) !== 2;
      if (!isEndpoint && !isJunction) continue;
      const coordinates = simplifyCoordinates(
        line.coordinates.slice(startIndex, index + 1),
        SIMPLIFICATION_TOLERANCE_METERS,
      );
      if (coordinates.length >= 2) {
        edgeDrafts.push({
          fromKey: coordinateKey(coordinates[0]),
          toKey: coordinateKey(coordinates.at(-1)),
          coordinates,
          roadClass: line.roadClass,
          surface: line.surface,
          oneWay: line.oneWay,
        });
      }
      startIndex = index;
    }
  }

  const mergedEdgeDrafts = keepLargestConnectedComponent(
    mergeCompatibleEdges(edgeDrafts),
  );
  const nodeKeys = [
    ...new Set(mergedEdgeDrafts.flatMap((edge) => [edge.fromKey, edge.toKey])),
  ].sort();
  const nodeIds = new Map(nodeKeys.map((key, index) => [key, index]));
  const nodes = nodeKeys.map((key, id) => ({
    id,
    coordinates: key.split(',').map(Number),
  }));

  mergedEdgeDrafts.sort((a, b) => {
    const aKey = `${a.fromKey}|${a.toKey}|${a.roadClass}|${a.surface}|${JSON.stringify(a.coordinates)}`;
    const bKey = `${b.fromKey}|${b.toKey}|${b.roadClass}|${b.surface}|${JSON.stringify(b.coordinates)}`;
    return aKey.localeCompare(bKey);
  });
  const edges = mergedEdgeDrafts.map((edge, id) => ({
    id,
    from: nodeIds.get(edge.fromKey),
    to: nodeIds.get(edge.toKey),
    coordinates: edge.coordinates,
    distanceMeters: Number(lineDistanceMeters(edge.coordinates).toFixed(2)),
    roadClass: edge.roadClass,
    surface: edge.surface,
    oneWay: edge.oneWay,
    speedMultiplier: SPEED_MULTIPLIERS[edge.roadClass],
  }));

  return {
    version: 2,
    generatedAt: GENERATED_AT,
    sourceId: SOURCE_ID,
    bounds: [
      [BOUNDS[0], BOUNDS[1]],
      [BOUNDS[2], BOUNDS[3]],
    ],
    nodes,
    edges,
  };
}

await mkdir(CACHE_DIR, { recursive: true });
await mkdir(dirname(OUTPUT), { recursive: true });

run('osmium', [
  'extract',
  '--strategy=complete_ways',
  '--bbox',
  BOUNDS.join(','),
  '--overwrite',
  '--output',
  EXTRACT,
  SOURCE,
]);
run('osmium', [
  'tags-filter',
  '--overwrite',
  '--output',
  FILTERED,
  EXTRACT,
  ...ROAD_CLASSES.map((roadClass) => `w/highway=${roadClass}`),
  ...ROAD_CLASSES.slice(0, 5).map((roadClass) => `w/highway=${roadClass}_link`),
]);
run('osmium', [
  'export',
  '--geometry-types=linestring',
  '--overwrite',
  '--output',
  GEOJSON,
  FILTERED,
]);

const collection = JSON.parse(await readFile(GEOJSON, 'utf8'));
const network = buildNetwork(collection);
if (network.nodes.length === 0 || network.edges.length === 0) {
  throw new Error('La fuente no produjo nodos ni aristas transitables.');
}

const serialized = `${JSON.stringify(network)}\n`;
await writeFile(OUTPUT, serialized);
const checksum = createHash('sha256').update(serialized).digest('hex');
await writeFile(
  CHECKSUM_OUTPUT,
  `${checksum}  public/data/roads/western-corridor.json\n`,
);
await rm(EXTRACT, { force: true });
await rm(FILTERED, { force: true });
await rm(GEOJSON, { force: true });

console.log(
  `Red vial generada: ${network.nodes.length} nodos, ${network.edges.length} aristas, ${Buffer.byteLength(serialized)} bytes.`,
);

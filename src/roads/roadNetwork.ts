import { roadNetworkConfig } from '../config/roads.config';
import type {
  RoadClass,
  RoadEdge,
  RoadNetwork,
  RoadNode,
} from '../types/roads';
import { RoadSpatialIndex, setDefaultRoadSpatialIndex } from './spatialIndex';

const ROAD_CLASSES = new Set<RoadClass>([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'service',
  'track',
]);

export interface LoadedRoadNetwork {
  network: RoadNetwork;
  index: RoadSpatialIndex;
  loadDurationMilliseconds: number;
  fileSizeBytes: number;
}

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (coordinate) =>
        typeof coordinate === 'number' && Number.isFinite(coordinate),
    )
  );
}

function isNode(value: unknown): value is RoadNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as Partial<RoadNode>;
  return Number.isInteger(node.id) && isCoordinate(node.coordinates);
}

function isEdge(value: unknown): value is RoadEdge {
  if (!value || typeof value !== 'object') return false;
  const edge = value as Partial<RoadEdge>;
  return (
    Number.isInteger(edge.id) &&
    Number.isInteger(edge.from) &&
    Number.isInteger(edge.to) &&
    Array.isArray(edge.coordinates) &&
    edge.coordinates.length >= 2 &&
    edge.coordinates.every(isCoordinate) &&
    typeof edge.distanceMeters === 'number' &&
    edge.distanceMeters > 0 &&
    typeof edge.roadClass === 'string' &&
    ROAD_CLASSES.has(edge.roadClass) &&
    typeof edge.oneWay === 'boolean' &&
    typeof edge.speedMultiplier === 'number' &&
    edge.speedMultiplier > 0
  );
}

export function parseRoadNetwork(value: unknown): RoadNetwork {
  if (!value || typeof value !== 'object')
    throw new Error('La red vial no es un objeto.');
  const network = value as Partial<RoadNetwork>;
  if (
    network.version !== 1 ||
    typeof network.generatedAt !== 'string' ||
    typeof network.sourceId !== 'string' ||
    !Array.isArray(network.bounds) ||
    network.bounds.length !== 2 ||
    !network.bounds.every(isCoordinate) ||
    !Array.isArray(network.nodes) ||
    !network.nodes.every(isNode) ||
    !Array.isArray(network.edges) ||
    !network.edges.every(isEdge)
  ) {
    throw new Error('La red vial local tiene un formato incompatible.');
  }
  return network as RoadNetwork;
}

let loadedNetwork: LoadedRoadNetwork | null = null;
let loadingNetwork: Promise<LoadedRoadNetwork> | null = null;

export function loadRoadNetwork(): Promise<LoadedRoadNetwork> {
  if (loadedNetwork) return Promise.resolve(loadedNetwork);
  if (loadingNetwork) return loadingNetwork;

  loadingNetwork = (async () => {
    const startedAt = performance.now();
    const response = await fetch(roadNetworkConfig.dataUrl, {
      credentials: 'same-origin',
    });
    if (!response.ok) {
      throw new Error(
        `No se pudo cargar la red vial local (${String(response.status)}).`,
      );
    }
    const serialized = await response.text();
    const network = parseRoadNetwork(JSON.parse(serialized) as unknown);
    const index = new RoadSpatialIndex(network);
    setDefaultRoadSpatialIndex(index);
    loadedNetwork = {
      network,
      index,
      loadDurationMilliseconds: performance.now() - startedAt,
      fileSizeBytes: new TextEncoder().encode(serialized).byteLength,
    };
    return loadedNetwork;
  })().catch((error: unknown) => {
    loadingNetwork = null;
    throw error;
  });
  return loadingNetwork;
}

export function getLoadedRoadNetwork(): LoadedRoadNetwork | null {
  return loadedNetwork;
}

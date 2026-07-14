import { roadNetworkConfig } from '../config/roads.config';
import type {
  RoadClass,
  RoadEdge,
  RoadNetwork,
  RoadNode,
  RoadSurface,
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
const ROAD_SURFACES = new Set<RoadSurface>([...ROAD_CLASSES, 'dirt-road']);

export interface LoadedRoadNetwork {
  network: RoadNetwork;
  index: RoadSpatialIndex;
  loadDurationMilliseconds: number;
  fileSizeBytes: number;
  metrics: RoadNetworkLoadMetrics;
}

export interface RoadNetworkLoadMetrics {
  downloadDurationMilliseconds: number;
  decodeDurationMilliseconds: number;
  parseDurationMilliseconds: number;
  validationDurationMilliseconds: number;
  indexDurationMilliseconds: number;
  totalDurationMilliseconds: number;
  fileSizeBytes: number;
  approximateMemoryBytes: number;
  nodeCount: number;
  edgeCount: number;
}

interface DownloadedRoadNetwork {
  buffer: ArrayBuffer;
  durationMilliseconds: number;
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
    (edge.surface === undefined ||
      (typeof edge.surface === 'string' && ROAD_SURFACES.has(edge.surface))) &&
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
    (network.version !== 1 && network.version !== 2) ||
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
let downloadingNetwork: Promise<DownloadedRoadNetwork> | null = null;

function downloadRoadNetwork(): Promise<DownloadedRoadNetwork> {
  downloadingNetwork ??= (async () => {
    const startedAt = performance.now();
    const response = await fetch(roadNetworkConfig.dataUrl, {
      credentials: 'same-origin',
    });
    if (!response.ok) {
      throw new Error(
        `No se pudo cargar la red vial local (${String(response.status)}).`,
      );
    }
    return {
      buffer: await response.arrayBuffer(),
      durationMilliseconds: performance.now() - startedAt,
    };
  })().catch((error: unknown) => {
    downloadingNetwork = null;
    throw error;
  });
  return downloadingNetwork;
}

function approximateNetworkMemoryBytes(
  network: RoadNetwork,
  serializedBytes: number,
): number {
  const coordinateCount = network.edges.reduce(
    (total, edge) => total + edge.coordinates.length,
    0,
  );
  return (
    serializedBytes +
    network.nodes.length * 32 +
    network.edges.length * 80 +
    coordinateCount * 24
  );
}

export function loadRoadNetwork(): Promise<LoadedRoadNetwork> {
  if (loadedNetwork) return Promise.resolve(loadedNetwork);
  if (loadingNetwork) return loadingNetwork;

  loadingNetwork = (async () => {
    const startedAt = performance.now();
    const downloaded = await downloadRoadNetwork();
    let stageStartedAt = performance.now();
    const serialized = new TextDecoder().decode(downloaded.buffer);
    const decodeDurationMilliseconds = performance.now() - stageStartedAt;
    stageStartedAt = performance.now();
    const parsed = JSON.parse(serialized) as unknown;
    const parseDurationMilliseconds = performance.now() - stageStartedAt;
    stageStartedAt = performance.now();
    const network = parseRoadNetwork(parsed);
    const validationDurationMilliseconds = performance.now() - stageStartedAt;
    stageStartedAt = performance.now();
    const index = new RoadSpatialIndex(network);
    const indexDurationMilliseconds = performance.now() - stageStartedAt;
    setDefaultRoadSpatialIndex(index);
    const fileSizeBytes = downloaded.buffer.byteLength;
    const totalDurationMilliseconds = performance.now() - startedAt;
    loadedNetwork = {
      network,
      index,
      loadDurationMilliseconds: totalDurationMilliseconds,
      fileSizeBytes,
      metrics: {
        downloadDurationMilliseconds: downloaded.durationMilliseconds,
        decodeDurationMilliseconds,
        parseDurationMilliseconds,
        validationDurationMilliseconds,
        indexDurationMilliseconds,
        totalDurationMilliseconds,
        fileSizeBytes,
        approximateMemoryBytes: approximateNetworkMemoryBytes(
          network,
          fileSizeBytes,
        ),
        nodeCount: network.nodes.length,
        edgeCount: network.edges.length,
      },
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

export async function copyRoadNetworkBuffer(): Promise<ArrayBuffer> {
  return (await downloadRoadNetwork()).buffer.slice(0);
}

export function retryRoadNetworkLoad(): Promise<LoadedRoadNetwork> {
  loadedNetwork = null;
  loadingNetwork = null;
  downloadingNetwork = null;
  setDefaultRoadSpatialIndex(null);
  return loadRoadNetwork();
}

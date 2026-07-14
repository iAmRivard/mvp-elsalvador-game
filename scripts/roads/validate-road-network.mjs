import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const NETWORK_PATH = 'public/data/roads/western-corridor.json';
const CHECKSUM_PATH = 'data/road-checksums.txt';
const ROAD_CLASSES = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'service',
  'track',
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const serialized = await readFile(NETWORK_PATH, 'utf8');
const network = JSON.parse(serialized);
invariant(network.version === 1, 'Version vial no compatible.');
invariant(typeof network.generatedAt === 'string', 'Falta generatedAt.');
invariant(
  network.sourceId === 'geofabrik-el-salvador-260712',
  'Fuente vial inesperada.',
);
invariant(
  Array.isArray(network.nodes) && network.nodes.length > 0,
  'No hay nodos.',
);
invariant(
  Array.isArray(network.edges) && network.edges.length > 0,
  'No hay aristas.',
);

const nodes = new Map();
const adjacency = [];
for (const [index, node] of network.nodes.entries()) {
  invariant(node.id === index, `ID de nodo no compacto en ${index}.`);
  invariant(
    Array.isArray(node.coordinates) &&
      node.coordinates.length === 2 &&
      node.coordinates.every(Number.isFinite),
    `Coordenadas invalidas en nodo ${index}.`,
  );
  nodes.set(node.id, node);
  adjacency.push([]);
}

for (const [index, edge] of network.edges.entries()) {
  invariant(edge.id === index, `ID de arista no compacto en ${index}.`);
  invariant(
    nodes.has(edge.from) && nodes.has(edge.to),
    `Arista ${index} sin nodo.`,
  );
  invariant(edge.from !== edge.to, `Arista ${index} forma un bucle vacio.`);
  invariant(
    ROAD_CLASSES.has(edge.roadClass),
    `Clase vial invalida en ${index}.`,
  );
  invariant(
    Number.isFinite(edge.distanceMeters) && edge.distanceMeters > 0,
    `Distancia invalida en ${index}.`,
  );
  invariant(
    Number.isFinite(edge.speedMultiplier) && edge.speedMultiplier > 0,
    `Velocidad invalida en ${index}.`,
  );
  invariant(
    Array.isArray(edge.coordinates) && edge.coordinates.length >= 2,
    `Geometria invalida en ${index}.`,
  );
  adjacency[edge.from].push(edge.to);
  adjacency[edge.to].push(edge.from);
}

const visited = new Set([0]);
const queue = [0];
for (let index = 0; index < queue.length; index += 1) {
  for (const neighbor of adjacency[queue[index]]) {
    if (visited.has(neighbor)) continue;
    visited.add(neighbor);
    queue.push(neighbor);
  }
}
invariant(
  visited.size === network.nodes.length,
  'La red vial contiene componentes aislados.',
);

const expectedChecksum = (await readFile(CHECKSUM_PATH, 'utf8'))
  .trim()
  .split(/\s+/)[0];
const actualChecksum = createHash('sha256').update(serialized).digest('hex');
invariant(
  actualChecksum === expectedChecksum,
  'El checksum de la red vial no coincide.',
);

const { size } = await stat(NETWORK_PATH);
invariant(size < 8 * 1024 * 1024, 'La red vial supera el limite de 8 MiB.');
console.log(
  `Red vial valida: ${network.nodes.length} nodos, ${network.edges.length} aristas, ${(size / 1024 / 1024).toFixed(2)} MiB.`,
);

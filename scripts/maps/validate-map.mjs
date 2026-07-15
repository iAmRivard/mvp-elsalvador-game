import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const paths = {
  map: resolve(root, 'public/maps/el-salvador.pmtiles'),
  style: resolve(root, 'public/map-assets/styles/el-salvador.json'),
  glyph: resolve(root, 'public/map-assets/fonts/Noto Sans Regular/0-255.pbf'),
  glyphExtended: resolve(
    root,
    'public/map-assets/fonts/Noto Sans Regular/256-511.pbf',
  ),
};

for (const file of Object.values(paths)) {
  const details = await stat(file);
  if (details.size <= 0) throw new Error(`Recurso cartográfico vacío: ${file}`);
}

const style = JSON.parse(await readFile(paths.style, 'utf8'));
if (Object.hasOwn(style, 'sprite')) {
  throw new Error('El estilo no debe declarar un sprite sin consumidores.');
}
const serializedLayers = JSON.stringify(style.layers ?? []);
for (const property of [
  'icon-image',
  'fill-pattern',
  'line-pattern',
  'background-pattern',
]) {
  if (serializedLayers.includes(`"${property}"`)) {
    throw new Error(
      `El estilo usa ${property}; revisa la política de sprites.`,
    );
  }
}

const mapHandle = await open(paths.map, 'r');
const mapHeader = Buffer.alloc(7);
try {
  await mapHandle.read(mapHeader, 0, mapHeader.length, 0);
} finally {
  await mapHandle.close();
}
if (mapHeader.toString('utf8') !== 'PMTiles') {
  throw new Error('El archivo no contiene una cabecera PMTiles válida.');
}

const checksumFile = resolve(root, 'data/checksums.txt');
const checksumRows = (await readFile(checksumFile, 'utf8'))
  .split(/\r?\n/u)
  .map((row) => row.trim())
  .filter(Boolean);
for (const row of checksumRows) {
  const match = /^(?<expected>[a-f0-9]{64})\s+(?<file>.+)$/u.exec(row);
  if (!match?.groups) throw new Error(`Checksum inválido: ${row}`);
  const hash = createHash('sha256');
  await new Promise((resolveHash, rejectHash) => {
    createReadStream(resolve(root, match.groups.file))
      .on('data', (chunk) => hash.update(chunk))
      .on('error', rejectHash)
      .on('end', resolveHash);
  });
  if (hash.digest('hex') !== match.groups.expected) {
    throw new Error(`Checksum no coincide: ${match.groups.file}`);
  }
}

const mapDetails = await stat(paths.map);
console.log(`Mapa válido: ${(mapDetails.size / 1_048_576).toFixed(2)} MiB`);

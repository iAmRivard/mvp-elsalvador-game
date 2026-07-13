import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const fontDirectory = join(root, 'public', 'map-assets', 'fonts', 'Noto Sans Regular');
const spriteDirectory = join(root, 'public', 'map-assets', 'sprites');
const glyphSourceDirectory = join(
  root,
  'node_modules',
  'smp-noto-glyphs',
  'fixtures',
  'glyphs',
);

await mkdir(fontDirectory, { recursive: true });
await mkdir(spriteDirectory, { recursive: true });
const glyphFiles = (await readdir(glyphSourceDirectory)).filter((file) => file.endsWith('.pbf'));
for (const glyphFile of glyphFiles) {
  await copyFile(join(glyphSourceDirectory, glyphFile), join(fontDirectory, glyphFile));
}

// PNG transparente de 1×1: el estilo no usa icon-image todavía, pero MapLibre requiere
// que ambos archivos del sprite existan cuando se declara la URL local.
const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
await writeFile(join(spriteDirectory, 'basemap.png'), transparentPng);
await writeFile(join(spriteDirectory, 'basemap.json'), '{}\n', 'utf8');

console.log('Glyphs y sprite técnico sincronizados en public/map-assets.');

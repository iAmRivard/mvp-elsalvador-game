import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const fontDirectory = join(
  root,
  'public',
  'map-assets',
  'fonts',
  'Noto Sans Regular',
);
const glyphSourceDirectory = join(
  root,
  'node_modules',
  'smp-noto-glyphs',
  'fixtures',
  'glyphs',
);

await mkdir(fontDirectory, { recursive: true });
const glyphFiles = (await readdir(glyphSourceDirectory)).filter((file) =>
  file.endsWith('.pbf'),
);
for (const glyphFile of glyphFiles) {
  await copyFile(
    join(glyphSourceDirectory, glyphFile),
    join(fontDirectory, glyphFile),
  );
}

console.log('Glyphs sincronizados en public/map-assets.');

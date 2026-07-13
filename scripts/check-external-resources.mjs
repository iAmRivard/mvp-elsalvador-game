import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const runtimeRoots = ['index.html', 'src', 'public'];
const textExtensions = new Set(['.css', '.gltf', '.html', '.js', '.json', '.svg', '.ts', '.tsx']);
const externalUrl = /https?:\/\/[^\s"')>]+/gi;
const protocolRelativeUrl = /["'`](\/\/[^"'`\s]+)["'`]/g;
const nonFetchingNamespaces = new Set(['http://www.w3.org/2000/svg']);

async function collect(path) {
  const stats = await import('node:fs/promises').then(({ stat }) => stat(path));
  if (stats.isFile()) return [path];

  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => collect(join(path, entry.name))),
  );
  return nested.flat();
}

const files = (await Promise.all(runtimeRoots.map((path) => collect(join(root, path))))).flat();
const violations = [];

for (const file of files) {
  if (!textExtensions.has(extname(file))) continue;
  const content = await readFile(file, 'utf8');
  const matches = [
    ...(content.match(externalUrl) ?? []),
    ...[...content.matchAll(protocolRelativeUrl)].map((match) => match[1]),
  ];

  for (const match of matches) {
    if (!nonFetchingNamespaces.has(match)) {
      violations.push(`${relative(root, file)}: ${match}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Se detectaron recursos externos en archivos de ejecución:');
  console.error(violations.map((violation) => `- ${violation}`).join('\n'));
  process.exit(1);
}

console.log(`Recursos externos: verificación superada (${files.length} archivos revisados).`);

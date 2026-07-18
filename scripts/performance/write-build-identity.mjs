import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const outputDirectory = resolve(process.argv[2] ?? 'dist');

function gitOutput(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

const buildSha = gitOutput(['rev-parse', 'HEAD']);
const worktreeStatus = gitOutput(['status', '--porcelain']);
if (!buildSha) throw new Error('No se pudo leer el SHA del build.');
if (worktreeStatus.length > 0) {
  throw new Error('El manifiesto requiere un worktree limpio.');
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  join(outputDirectory, 'build-identity.json'),
  `${JSON.stringify({ buildSha }, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${buildSha}\n`);

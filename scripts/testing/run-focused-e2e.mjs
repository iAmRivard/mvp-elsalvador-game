import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const profile = process.argv[2];
const fileFilters = process.argv.slice(3);
const profileArguments = {
  smoke: ['--grep', '@smoke'],
  camera: ['--grep', '@camera'],
  map: ['--grep', '@map'],
  'last-failed': ['--last-failed'],
};

if (!(profile in profileArguments)) {
  throw new Error(`Perfil E2E enfocado desconocido: ${profile ?? 'n/d'}.`);
}

const host = '127.0.0.1';
const port = 4173;
const baseUrl = `http://${host}:${port}`;
const viteBin = resolve('node_modules/vite/bin/vite.js');
const playwrightBin = resolve('node_modules/@playwright/test/cli.js');
let serverOutput = '';

const server = spawn(
  process.execPath,
  [viteBin, 'preview', '--host', host, '--port', String(port), '--strictPort'],
  { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);
server.stdout?.on('data', (chunk) => {
  serverOutput += String(chunk);
});
server.stderr?.on('data', (chunk) => {
  serverOutput += String(chunk);
});

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `El servidor de pruebas terminó antes de iniciar.\n${serverOutput}`,
      );
    }
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return;
    } catch {
      // El puerto todavía no está listo.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Vite no respondió en ${baseUrl}.\n${serverOutput}`);
}

async function stopServer() {
  if (server.exitCode !== null) return;
  server.kill();
  await Promise.race([
    new Promise((resolveClose) => server.once('close', resolveClose)),
    new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000)),
  ]);
  if (server.exitCode !== null) return;
  if (process.platform === 'win32' && server.pid) {
    spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  } else {
    server.kill('SIGKILL');
  }
}

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await new Promise((resolveExit) => {
    const runner = spawn(
      process.execPath,
      [
        playwrightBin,
        'test',
        '--project=chromium-mobile',
        '--workers=1',
        '--retries=0',
        '--max-failures=1',
        ...fileFilters,
        ...profileArguments[profile],
      ],
      {
        env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl },
        windowsHide: true,
        stdio: 'inherit',
      },
    );
    runner.once('error', () => resolveExit(1));
    runner.once('exit', (code) => resolveExit(code ?? 1));
  });
} finally {
  await stopServer();
}

process.exitCode = exitCode;

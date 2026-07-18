import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';

const outputDirectory = resolve(
  process.argv[2] ?? 'test-results/camera-map-v0.3.1',
);
const host = '127.0.0.1';
const port = 4173;
const baseUrl = `http://${host}:${port}`;
const warmupMilliseconds = 5_000;
const observationMilliseconds = 15_000;
const viewport = { width: 392, height: 850 };
const repositorySha = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const worktreeStatus = execFileSync('git', ['status', '--porcelain'], {
  encoding: 'utf8',
}).trim();

if (worktreeStatus.length > 0) {
  throw new Error('La captura requiere un worktree limpio.');
}

await mkdir(outputDirectory, { recursive: true });

const server = spawn(
  process.execPath,
  [
    resolve('node_modules/vite/bin/vite.js'),
    'preview',
    '--host',
    host,
    '--port',
    String(port),
    '--strictPort',
  ],
  { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);
let serverOutput = '';
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
      throw new Error(`Vite terminó antes de iniciar.\n${serverOutput}`);
    }
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return;
    } catch {
      // El servidor todavía no está listo.
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

function percentile(values, percentileRank) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * percentileRank) - 1),
    )
  ];
}

function average(values) {
  return values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function summarize(values) {
  return {
    samples: values.length,
    average: average(values),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    maximum: values.length > 0 ? Math.max(...values) : null,
  };
}

await waitForServer();
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    viewport,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto(baseUrl);
  const buildSha = await page
    .locator('[data-build-sha]')
    .getAttribute('data-build-sha');
  if (buildSha !== repositorySha) {
    throw new Error(
      `El build no corresponde al checkout: repo=${repositorySha}, build=${buildSha ?? 'n/d'}.`,
    );
  }

  await page.getByRole('button', { name: /Comenzar expedición/ }).click();
  await page.getByRole('button', { name: /Comenzar investigación/ }).click();
  const skip = page.getByRole('button', { name: 'Omitir' });
  if (await skip.isVisible()) await skip.click();
  const gameMap = page.getByTestId('game-map');
  await gameMap.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const map = document.querySelector('[data-testid="game-map"]');
    return (
      map instanceof HTMLElement && map.dataset.roadNetworkStatus === 'ready'
    );
  });
  await page.waitForTimeout(warmupMilliseconds);

  await page.evaluate(() => {
    const map = document.querySelector('[data-testid="game-map"]');
    if (!(map instanceof HTMLElement)) {
      throw new Error('No se encontró el mapa para iniciar la captura.');
    }
    window.__cameraMapCapture = {
      startedAt: performance.now(),
      lastFrameAt: null,
      frameDurations: [],
      cameraDurations: [],
      cameraApplications: [],
      projections: [],
      active: true,
    };
    const capture = window.__cameraMapCapture;
    capture.observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.attributeName !== 'data-camera-update-ms') continue;
        const duration = Number(map.dataset.cameraUpdateMs);
        if (Number.isFinite(duration)) capture.cameraDurations.push(duration);
        capture.cameraApplications.push(performance.now() - capture.startedAt);
      }
    });
    capture.observer.observe(map, {
      attributes: true,
      attributeFilter: ['data-camera-update-ms'],
    });
    const sample = (timestamp) => {
      if (!capture.active) return;
      if (capture.lastFrameAt !== null) {
        const duration = timestamp - capture.lastFrameAt;
        if (duration > 0) capture.frameDurations.push(duration);
      }
      capture.lastFrameAt = timestamp;
      const directX = Number(map.dataset.playerProjectedX);
      const directY = Number(map.dataset.playerProjectedY);
      const fallbackX =
        window.innerWidth / 2 + Number(map.dataset.cameraAppliedScreenOffsetX);
      const fallbackY =
        window.innerHeight / 2 + Number(map.dataset.cameraAppliedScreenOffsetY);
      const hasDirectProjection =
        Number.isFinite(directX) && Number.isFinite(directY);
      const playerX = hasDirectProjection ? directX : fallbackX;
      const playerY = hasDirectProjection ? directY : fallbackY;
      if (Number.isFinite(playerX) && Number.isFinite(playerY)) {
        capture.projections.push({
          elapsedMilliseconds: timestamp - capture.startedAt,
          x: playerX,
          y: playerY,
          source: hasDirectProjection
            ? 'player-projection'
            : 'exact-follow-target-fallback',
          speedKilometersPerHour: Number(
            map.dataset.playerSpeedKilometersPerHour,
          ),
          cadenceHertz: Number(map.dataset.cameraCadenceHertz),
          zoom: Number(map.dataset.followZoom),
          pitch: Number(map.dataset.followPitch),
          usefulMapAreaRatio: Number(map.dataset.usefulMapAreaRatio),
          visibleSymbolLayerCount: Number.isFinite(
            Number(map.dataset.mapVisibleSymbolLayerCount),
          )
            ? Number(map.dataset.mapVisibleSymbolLayerCount)
            : null,
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.screenshot({
    path: resolve(outputDirectory, '00-stopped.png'),
  });
  const joystick = page.getByLabel(/Joystick de conducción arcade/);
  const box = await joystick.boundingBox();
  if (!box) throw new Error('No se encontró el joystick móvil.');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, ...center, force: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 1,
        x: center.x,
        y: center.y - box.width * 0.22,
        force: 1,
      },
    ],
  });
  await page.waitForTimeout(1_000);
  await page.screenshot({
    path: resolve(outputDirectory, '01-acceleration.png'),
  });
  await page.waitForTimeout(3_000);
  await page.screenshot({
    path: resolve(outputDirectory, '02-cruise-30-50.png'),
  });
  await page.waitForTimeout(2_000);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 1,
        x: center.x,
        y: center.y - box.width * 0.5,
        force: 1,
      },
    ],
  });
  await page.waitForTimeout(4_000);
  await page.screenshot({
    path: resolve(outputDirectory, '03-fast-70-90.png'),
  });
  await page.waitForTimeout(1_000);
  const steeringSign = await gameMap.evaluate((element) => {
    const recommended = Number(element.dataset.navigationRecommendedHeading);
    const physical = Number(element.dataset.navigationPhysicalHeading);
    const delta = ((recommended - physical + 540) % 360) - 180;
    return Number.isFinite(delta) && Math.abs(delta) > 3 ? Math.sign(delta) : 1;
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 1,
        x: center.x + steeringSign * box.width * 0.35,
        y: center.y - box.width * 0.5,
        force: 1,
      },
    ],
  });
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: resolve(outputDirectory, '04-curve.png') });
  await page.waitForTimeout(2_000);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  const capture = await page.evaluate(() => {
    const state = window.__cameraMapCapture;
    if (!state) throw new Error('La captura de cámara no existe.');
    state.active = false;
    state.observer?.disconnect();
    const map = document.querySelector('[data-testid="game-map"]');
    return {
      frameDurations: state.frameDurations,
      cameraDurations: state.cameraDurations,
      cameraApplications: state.cameraApplications,
      projections: state.projections,
      mapDataset: map instanceof HTMLElement ? { ...map.dataset } : {},
      userAgent: navigator.userAgent,
      deviceScaleFactor: devicePixelRatio,
    };
  });
  await session.detach();

  const projectionDistances = capture.projections
    .slice(1)
    .map((sample, index) => {
      const previous = capture.projections[index];
      return Math.hypot(sample.x - previous.x, sample.y - previous.y);
    });
  const projectionBySpeed = (minimum, maximum) =>
    capture.projections.filter(
      (sample) =>
        sample.speedKilometersPerHour >= minimum &&
        sample.speedKilometersPerHour < maximum,
    );
  const cadenceIntervals = capture.cameraApplications
    .slice(1)
    .map((timestamp, index) => timestamp - capture.cameraApplications[index]);
  const metrics = {
    captureMetadata: {
      repositorySha,
      buildSha,
      capturedAt: new Date().toISOString(),
      browserName: 'chromium',
      browserVersion: browser.version(),
      userAgent: capture.userAgent,
      viewport,
      deviceScaleFactor: capture.deviceScaleFactor,
      warmupMilliseconds,
      observationMilliseconds,
      diagnosticsEnabled: capture.mapDataset.diagnosticsEnabled === 'true',
      physicalPlaytestRequired: true,
    },
    phases: {
      stoppedSamples: projectionBySpeed(0, 1).length,
      accelerationAndCruiseSamples: projectionBySpeed(1, 50).length,
      fastSamples: projectionBySpeed(70, 100).length,
      finalSpeedKilometersPerHour: Number(
        capture.mapDataset.playerSpeedKilometersPerHour,
      ),
    },
    vehicleProjection: {
      source: capture.projections.at(-1)?.source ?? null,
      first: capture.projections.at(0) ?? null,
      last: capture.projections.at(-1) ?? null,
      consecutiveDistancePixels: summarize(projectionDistances),
      distinctRoundedPositions: new Set(
        capture.projections.map(
          (sample) => `${sample.x.toFixed(1)},${sample.y.toFixed(1)}`,
        ),
      ).size,
    },
    cameraScreenCenter: { x: viewport.width / 2, y: viewport.height / 2 },
    camera: {
      appliedUpdates: capture.cameraApplications.length,
      appliedUpdatesPerSecond:
        capture.cameraApplications.length / (observationMilliseconds / 1_000),
      updateMilliseconds: summarize(capture.cameraDurations),
      appliedIntervalMilliseconds: summarize(cadenceIntervals),
      finalCadenceHertz: Number(capture.mapDataset.cameraCadenceHertz),
      finalZoom: Number(capture.mapDataset.followZoom),
      finalPitch: Number(capture.mapDataset.followPitch),
    },
    frameTimeMilliseconds: {
      ...summarize(capture.frameDurations),
      over33Milliseconds: capture.frameDurations.filter((value) => value > 33)
        .length,
      over50Milliseconds: capture.frameDurations.filter((value) => value > 50)
        .length,
      over100Milliseconds: capture.frameDurations.filter((value) => value > 100)
        .length,
    },
    map: {
      detailMode:
        capture.mapDataset.mapDetailMode ??
        capture.mapDataset.mapDeclutterProfile ??
        null,
      visibleSymbolLayerCount: Number.isFinite(
        Number(capture.mapDataset.mapVisibleSymbolLayerCount),
      )
        ? Number(capture.mapDataset.mapVisibleSymbolLayerCount)
        : null,
      renderedLabelCount:
        capture.mapDataset.diagnosticsEnabled === 'true'
          ? Number(capture.mapDataset.renderedSymbolCount)
          : null,
      usefulMapAreaRatio: Number(capture.mapDataset.usefulMapAreaRatio),
      playerOutsideSafeViewport:
        capture.mapDataset.playerOutsideSafeViewport ?? null,
    },
  };
  await writeFile(
    resolve(outputDirectory, 'metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
    'utf8',
  );
  await context.close();
} finally {
  await browser.close();
  await stopServer();
}

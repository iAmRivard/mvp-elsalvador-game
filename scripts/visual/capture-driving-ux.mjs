import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173';
const outputDirectory = resolve(
  process.argv[3] ?? 'test-results/driving-ux-v0.2.5.3',
);
const observationMilliseconds = 30_000;
const warmupMilliseconds = 10_000;
const captureSchemaVersion = 3;
const referenceViewport = { width: 392, height: 850 };
const referenceDeviceScaleFactor = 2;
const measuredSha = (() => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
})();
await mkdir(outputDirectory, { recursive: true });

function percentile(sortedValues, percentage) {
  if (sortedValues.length === 0) return null;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentage) - 1),
  );
  return sortedValues[index];
}

function summarize(values) {
  const finiteValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finiteValues.length === 0) {
    return {
      samples: 0,
      average: null,
      median: null,
      p95: null,
      p99: null,
      maximum: null,
    };
  }
  return {
    samples: finiteValues.length,
    average:
      finiteValues.reduce((total, value) => total + value, 0) /
      finiteValues.length,
    median: percentile(finiteValues, 0.5),
    p95: percentile(finiteValues, 0.95),
    p99: percentile(finiteValues, 0.99),
    maximum: finiteValues.at(-1),
  };
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    viewport: referenceViewport,
    screen: referenceViewport,
    deviceScaleFactor: referenceDeviceScaleFactor,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.__v0251LongTasks = [];
    window.__v0251FrameDurations = [];
    let previousFrameTimestamp = null;
    const sampleFrame = (timestamp) => {
      if (previousFrameTimestamp !== null) {
        window.__v0251FrameDurations.push(timestamp - previousFrameTimestamp);
      }
      previousFrameTimestamp = timestamp;
      window.requestAnimationFrame(sampleFrame);
    };
    window.requestAnimationFrame(sampleFrame);
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__v0251LongTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
            });
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch {
        // Long Tasks API no está disponible en todos los navegadores.
      }
    }
  });
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  const beginMission = page.getByRole('button', {
    name: /Comenzar investigación/,
  });
  await beginMission.waitFor({ state: 'visible' });
  await beginMission.click();
  const skipTutorial = page.getByRole('button', { name: 'Omitir' });
  await skipTutorial.waitFor({ state: 'visible' });
  await skipTutorial.click();
  await page.waitForFunction(() => {
    const map = document.querySelector('[data-testid="game-map"]');
    return (
      map instanceof HTMLElement &&
      ['ready', 'unavailable'].includes(map.dataset.roadNetworkStatus ?? '')
    );
  });
  const closeRadio = page.getByRole('button', { name: 'Cerrar transmisión' });
  if (await closeRadio.isVisible()) await closeRadio.click();

  const joystick = page.getByLabel(
    /Joystick de (conducción arcade|velocidad objetivo)/,
  );
  const joystickBox = await joystick.boundingBox();
  if (!joystickBox) throw new Error('No se encontró el joystick móvil.');
  const centerX = joystickBox.x + joystickBox.width / 2;
  const centerY = joystickBox.y + joystickBox.height / 2;
  const session = await context.newCDPSession(page);
  const inputStartedAt = Date.now();
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, x: centerX, y: centerY, force: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 1,
        x: centerX,
        y: centerY - joystickBox.width * 0.44,
        force: 1,
      },
    ],
  });
  await page.waitForFunction(() => {
    const map = document.querySelector('[data-testid="game-map"]');
    return (
      map instanceof HTMLElement &&
      Number.parseFloat(map.dataset.inputTargetSpeed ?? '0') >= 58
    );
  });
  const timeToSelect58KphTargetMilliseconds = Date.now() - inputStartedAt;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.getByTestId('game-map').waitFor({ state: 'visible' });
  await page.screenshot({
    path: resolve(outputDirectory, 'v0.2.5.3-mobile-after.png'),
  });

  await page.waitForTimeout(warmupMilliseconds);

  const initial = await page.evaluate(() => {
    const count = (selector, key = 'renderCount') => {
      const element = document.querySelector(selector);
      return element instanceof HTMLElement
        ? Number(element.dataset[key] ?? 0)
        : 0;
    };
    const map = document.querySelector('[data-testid="game-map"]');
    window.__v0251LongTasks = [];
    window.__v0251FrameDurations = [];
    window.__v0251CameraDurations = [];
    window.__v0251RoadTrackerDurations = [];
    window.__v0251MemorySamples = [];
    window.__v0251MapCounters = {
      cameraUpdates: 0,
      renderedFeatureQueries: 0,
      telemetryTicks: 0,
      geoJsonSourceUpdates: 0,
    };
    const memory = performance.memory;
    if (memory) window.__v0251MemorySamples.push(memory.usedJSHeapSize);
    window.__v0251MemoryInterval = window.setInterval(() => {
      const currentMemory = performance.memory;
      if (currentMemory) {
        window.__v0251MemorySamples.push(currentMemory.usedJSHeapSize);
      }
    }, 100);
    window.__v0251DeclutterChanges = 0;
    if (map instanceof HTMLElement) {
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (!(record.target instanceof HTMLElement)) continue;
          switch (record.attributeName) {
            case 'data-map-declutter-profile':
              window.__v0251DeclutterChanges += 1;
              break;
            case 'data-camera-update-ms': {
              const value = Number(record.target.dataset.cameraUpdateMs);
              if (Number.isFinite(value)) {
                window.__v0251CameraDurations.push(value);
                window.__v0251MapCounters.cameraUpdates += 1;
              }
              break;
            }
            case 'data-road-search-last-ms': {
              const value = Number(record.target.dataset.roadSearchLastMs);
              if (Number.isFinite(value)) {
                window.__v0251RoadTrackerDurations.push(value);
              }
              break;
            }
            case 'data-rendered-symbol-count':
              window.__v0251MapCounters.renderedFeatureQueries += 1;
              break;
            case 'data-player-longitude':
              window.__v0251MapCounters.telemetryTicks += 1;
              break;
            case 'data-geo-json-source-updates':
              window.__v0251MapCounters.geoJsonSourceUpdates += 1;
              break;
          }
        }
      });
      observer.observe(map, {
        attributes: true,
        attributeFilter: [
          'data-map-declutter-profile',
          'data-camera-update-ms',
          'data-road-search-last-ms',
          'data-rendered-symbol-count',
          'data-player-longitude',
          'data-geo-json-source-updates',
        ],
      });
      window.__v0251MapObserver = observer;
    }
    return {
      mobileDrivingHud: count('.mobile-driving-hud'),
      playerHud: count('.player-hud'),
      missionPanel: count('.mission-panel'),
      missionPanelHeavy: count('.mission-panel', 'sheetRenderCount'),
      radio: count('.radio-message'),
      cameraRequestedUpdates:
        map instanceof HTMLElement
          ? Number(map.dataset.cameraRequestedUpdates ?? 0)
          : 0,
      cameraAppliedUpdates:
        map instanceof HTMLElement
          ? Number(map.dataset.cameraAppliedUpdates ?? 0)
          : 0,
      cameraSkippedByInterval:
        map instanceof HTMLElement
          ? Number(map.dataset.cameraSkippedByInterval ?? 0)
          : 0,
      cameraSkippedByTolerance:
        map instanceof HTMLElement
          ? Number(map.dataset.cameraSkippedByTolerance ?? 0)
          : 0,
      cameraOffsetAppliedUpdates:
        map instanceof HTMLElement
          ? Number(map.dataset.cameraOffsetAppliedUpdates ?? 0)
          : 0,
      cameraProfileTransitions:
        map instanceof HTMLElement
          ? Number(map.dataset.cameraProfileTransitions ?? 0)
          : 0,
      cameraFallbackMarkerUpdates:
        map instanceof HTMLElement
          ? Number(map.dataset.cameraFallbackMarkerUpdates ?? 0)
          : 0,
      cameraThreePlayerUpdates:
        map instanceof HTMLElement
          ? Number(map.dataset.cameraThreePlayerUpdates ?? 0)
          : 0,
      threeDrivingEffectsUpdates:
        map instanceof HTMLElement
          ? Number(map.dataset.threeDrivingEffectsUpdates ?? 0)
          : 0,
    };
  });

  await page.waitForTimeout(observationMilliseconds);

  const metrics = await page.evaluate(() => {
    const box = (selector) => {
      const rectangle = document
        .querySelector(selector)
        ?.getBoundingClientRect();
      return rectangle
        ? {
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
          }
        : null;
    };
    const map = document.querySelector('[data-testid="game-map"]');
    const count = (selector, key = 'renderCount') => {
      const element = document.querySelector(selector);
      return element instanceof HTMLElement
        ? Number(element.dataset[key] ?? 0)
        : 0;
    };
    const longTasks = window.__v0251LongTasks ?? [];
    window.__v0251MapObserver?.disconnect();
    window.clearInterval(window.__v0251MemoryInterval);
    return {
      observationMilliseconds: 30_000,
      warmupMilliseconds: 10_000,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      deviceScaleFactor: window.devicePixelRatio,
      userAgent: window.navigator.userAgent,
      hud: box('[data-testid="mobile-driving-hud"]'),
      joystick: box(
        '[aria-label="Joystick de conducción arcade"], [aria-label="Joystick de velocidad objetivo"]',
      ),
      actions: box('.touch-actions'),
      mapDataset: map instanceof HTMLElement ? { ...map.dataset } : {},
      counters: {
        mobileDrivingHud: count('.mobile-driving-hud'),
        playerHud: count('.player-hud'),
        missionPanel: count('.mission-panel'),
        missionPanelHeavy: count('.mission-panel', 'sheetRenderCount'),
        radio: count('.radio-message'),
        cameraRequestedUpdates:
          map instanceof HTMLElement
            ? Number(map.dataset.cameraRequestedUpdates ?? 0)
            : 0,
        cameraAppliedUpdates:
          map instanceof HTMLElement
            ? Number(map.dataset.cameraAppliedUpdates ?? 0)
            : 0,
        cameraSkippedByInterval:
          map instanceof HTMLElement
            ? Number(map.dataset.cameraSkippedByInterval ?? 0)
            : 0,
        cameraSkippedByTolerance:
          map instanceof HTMLElement
            ? Number(map.dataset.cameraSkippedByTolerance ?? 0)
            : 0,
        cameraOffsetAppliedUpdates:
          map instanceof HTMLElement
            ? Number(map.dataset.cameraOffsetAppliedUpdates ?? 0)
            : 0,
        cameraProfileTransitions:
          map instanceof HTMLElement
            ? Number(map.dataset.cameraProfileTransitions ?? 0)
            : 0,
        cameraFallbackMarkerUpdates:
          map instanceof HTMLElement
            ? Number(map.dataset.cameraFallbackMarkerUpdates ?? 0)
            : 0,
        cameraThreePlayerUpdates:
          map instanceof HTMLElement
            ? Number(map.dataset.cameraThreePlayerUpdates ?? 0)
            : 0,
        threeDrivingEffectsUpdates:
          map instanceof HTMLElement
            ? Number(map.dataset.threeDrivingEffectsUpdates ?? 0)
            : 0,
      },
      declutterChanges: window.__v0251DeclutterChanges ?? 0,
      samples: {
        frameDurations: window.__v0251FrameDurations ?? [],
        cameraDurations: window.__v0251CameraDurations ?? [],
        roadTrackerDurations: window.__v0251RoadTrackerDurations ?? [],
        memoryBytes: window.__v0251MemorySamples ?? [],
      },
      mapCounters: window.__v0251MapCounters ?? {},
      longTasks: {
        count: longTasks.length,
        totalMilliseconds: longTasks.reduce(
          (total, task) => total + task.duration,
          0,
        ),
        maximumMilliseconds: longTasks.reduce(
          (maximum, task) => Math.max(maximum, task.duration),
          0,
        ),
      },
    };
  });
  metrics.renderDeltas = Object.fromEntries(
    [
      'mobileDrivingHud',
      'playerHud',
      'missionPanel',
      'missionPanelHeavy',
      'radio',
    ].map((key) => [key, metrics.counters[key] - initial[key]]),
  );
  metrics.cameraCounterDeltas = {
    requested:
      metrics.counters.cameraRequestedUpdates - initial.cameraRequestedUpdates,
    applied:
      metrics.counters.cameraAppliedUpdates - initial.cameraAppliedUpdates,
    skippedByInterval:
      metrics.counters.cameraSkippedByInterval -
      initial.cameraSkippedByInterval,
    skippedByTolerance:
      metrics.counters.cameraSkippedByTolerance -
      initial.cameraSkippedByTolerance,
    offsetApplied:
      metrics.counters.cameraOffsetAppliedUpdates -
      initial.cameraOffsetAppliedUpdates,
    profileTransitions:
      metrics.counters.cameraProfileTransitions -
      initial.cameraProfileTransitions,
    fallbackMarkerUpdates:
      metrics.counters.cameraFallbackMarkerUpdates -
      initial.cameraFallbackMarkerUpdates,
    threePlayerUpdates:
      metrics.counters.cameraThreePlayerUpdates -
      initial.cameraThreePlayerUpdates,
    threeDrivingEffectsUpdates:
      metrics.counters.threeDrivingEffectsUpdates -
      initial.threeDrivingEffectsUpdates,
  };
  metrics.cameraCounterDeltas.requestedPerSecond =
    metrics.cameraCounterDeltas.requested /
    (metrics.observationMilliseconds / 1_000);
  metrics.cameraCounterDeltas.appliedPerSecond =
    metrics.cameraCounterDeltas.applied /
    (metrics.observationMilliseconds / 1_000);
  const frameDurations = metrics.samples.frameDurations;
  metrics.frameTimeMilliseconds = {
    ...summarize(frameDurations),
    over33Milliseconds: frameDurations.filter((value) => value > 33).length,
    over50Milliseconds: frameDurations.filter((value) => value > 50).length,
    over100Milliseconds: frameDurations.filter((value) => value > 100).length,
  };
  metrics.instantaneousFramesPerSecond = summarize(
    frameDurations.filter((value) => value > 0).map((value) => 1_000 / value),
  );
  const observedFrameTimeMilliseconds = frameDurations.reduce(
    (total, value) => total + value,
    0,
  );
  metrics.framesPerSecondThroughput =
    observedFrameTimeMilliseconds > 0
      ? (frameDurations.length * 1_000) / observedFrameTimeMilliseconds
      : null;
  metrics.cameraMilliseconds = summarize(metrics.samples.cameraDurations);
  metrics.roadTrackerMilliseconds = summarize(
    metrics.samples.roadTrackerDurations,
  );
  const memoryMegabytes = metrics.samples.memoryBytes.map(
    (value) => value / 1024 / 1024,
  );
  metrics.memoryMegabytes = {
    ...summarize(memoryMegabytes),
    initial: memoryMegabytes.at(0) ?? null,
    final: memoryMegabytes.at(-1) ?? null,
  };
  metrics.timeToSelect58KphTargetMilliseconds =
    timeToSelect58KphTargetMilliseconds;
  const inputNextAnimationFrameLatency = Number(
    metrics.mapDataset.inputNextAnimationFrameLatencyMs ?? Number.NaN,
  );
  const inputStoredLatency = Number(
    metrics.mapDataset.inputStoredLatencyMs ?? Number.NaN,
  );
  const inputConsumptionLatency = Number(
    metrics.mapDataset.inputConsumptionLatencyMs ?? Number.NaN,
  );
  metrics.inputNextAnimationFrameMilliseconds = Number.isFinite(
    inputNextAnimationFrameLatency,
  )
    ? inputNextAnimationFrameLatency
    : null;
  metrics.inputVisualLatencyMilliseconds = null;
  metrics.inputStoredLatencyMilliseconds = Number.isFinite(inputStoredLatency)
    ? inputStoredLatency
    : null;
  metrics.inputConsumptionLatencyMilliseconds = Number.isFinite(
    inputConsumptionLatency,
  )
    ? inputConsumptionLatency
    : null;
  metrics.captureMetadata = {
    schemaVersion: captureSchemaVersion,
    measuredSha,
    baseUrl,
    capturedAt: new Date().toISOString(),
    browserName: 'chromium',
    browserVersion: browser.version(),
    buildMode:
      metrics.mapDataset.performanceProfilingEnabled === 'true'
        ? 'production-profiling'
        : 'production-normal',
    performanceProfilingEnabled:
      metrics.mapDataset.performanceProfilingEnabled === 'true',
    diagnosticsEnabled: metrics.mapDataset.diagnosticsEnabled === 'true',
    scenario: {
      id: 'arcade-core-road-cruise-v1',
      viewport: referenceViewport,
      deviceScaleFactor: referenceDeviceScaleFactor,
      warmupMilliseconds,
      observationMilliseconds,
      touchGesture: {
        source: 'cdp-touch',
        verticalTravelJoystickRatio: 0.44,
        targetKilometersPerHour: 58,
      },
      storage: 'clean',
      onboarding: 'narrative-closed-tutorial-skipped',
      roadNetwork: 'ready-or-degraded-after-startup-gate',
    },
    cameraTimingScope:
      'map camera call, exposeCameraTarget and follow-state bookkeeping',
    inputTimingScope:
      'event to stored, next game-loop consumption and next animation frame; presentation latency unavailable',
  };
  await writeFile(
    resolve(outputDirectory, 'arcade-core-mobile-metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
    'utf8',
  );
  const captureViewports = [
    { name: 'reference-392', width: 392, height: 850 },
    { name: 'portrait-412', width: 412, height: 850 },
    { name: 'landscape', width: 850, height: 412 },
    { name: 'tablet', width: 768, height: 1_024 },
    { name: 'small', width: 360, height: 640 },
  ];
  for (const viewport of captureViewports) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.waitForTimeout(250);
    await page.screenshot({
      path: resolve(outputDirectory, `v0.2.5.3-mobile-${viewport.name}.png`),
    });
  }
  await session.detach();
  await context.close();
} finally {
  await browser.close();
}

console.log(`Driving UX capture written to ${outputDirectory}`);

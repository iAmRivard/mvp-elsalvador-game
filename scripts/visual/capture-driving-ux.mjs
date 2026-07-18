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
const captureSchemaVersion = 5;
const referenceViewport = { width: 392, height: 850 };
const referenceDeviceScaleFactor = 2;
const deterministicCheckpoint = {
  longitude: -89.2698289,
  latitude: 13.8254447,
  headingDegrees: 244.8,
  expectedSurface: 'trunk',
  acceptedEdgeIds: [10999],
};
const deterministicRandomSeed = 0x30a0c0de;
const deterministicStorage = {
  save: {
    version: 5,
    savedAt: '2026-07-17T00:00:00.000Z',
    game: {
      onboardingState: 'completed',
      player: {
        longitude: deterministicCheckpoint.longitude,
        latitude: deterministicCheckpoint.latitude,
        heading: deterministicCheckpoint.headingDegrees,
        speedMetersPerSecond: 0,
        fuel: 75,
        totalDistanceMeters: 1_250,
      },
      energy: 100,
      maxEnergy: 100,
      experience: 0,
      activeMissionId: null,
      activeMissionCompletedObjectiveIds: [],
      activeMissionObjectiveProgress: {},
      missionChoiceSelections: {},
      storyLogEntries: [],
      completedMissionIds: [
        'la-transmision',
        'camino-hacia-santa-ana',
        'estacion-abandonada',
        'reparacion-de-emergencia',
        'llegada-a-santa-ana',
        'secreto-de-coatepeque',
        'senales-en-suchitoto',
      ],
      discoveredLocationIds: [],
      unlockedLocationIds: ['san-salvador'],
      specialItemIds: [],
      unlockedStoryIds: [],
      inventory: [],
      vehicle: { condition: 100, fuel: 75, maximumFuel: 100 },
      currentChapterId: 'chapter-1',
      completedChapterIds: [],
      navigationTarget: null,
      roadNetworkVersion: 2,
      isPaused: false,
      isFollowingPlayer: true,
    },
  },
  settings: {
    version: 8,
    settings: {
      graphicsQuality: 'medium',
      reduceMotion: false,
      ambientFog: true,
      tutorialSeen: true,
      steeringSensitivity: 'medium',
      roadAssistMode: 'strong',
      audioMasterVolume: 0,
      audioEffectsVolume: 0,
      audioMusicVolume: 0,
      audioMuted: true,
      musicMuted: true,
      reduceAudioEffects: true,
      recommendedControlsPromptDismissed: true,
      singleDriveJoystickPromptDismissed: true,
      targetSpeedJoystickPromptDismissed: true,
      controlMode: 'target-speed-joystick',
      joystickPositionMode: 'fixed',
      joystickSize: 'medium',
      joystickDeadZone: 0.12,
      autoThrottleDefault: false,
      hapticsEnabled: false,
    },
  },
};
const repositorySha = (() => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
})();
const worktreeStatus = (() => {
  try {
    return execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
})();
if (!repositorySha || worktreeStatus === null) {
  throw new Error('No se pudo verificar la identidad del repositorio.');
}
if (worktreeStatus.length > 0) {
  throw new Error('La captura requiere un worktree limpio.');
}
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
  await page.addInitScript(
    ({ randomSeed, storage }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(
        'el-salvador-rutas-perdidas:save',
        JSON.stringify(storage.save),
      );
      window.localStorage.setItem(
        'el-salvador-rutas-perdidas:settings',
        JSON.stringify(storage.settings),
      );
      let seed = randomSeed >>> 0;
      Math.random = () => {
        seed += 0x6d2b79f5;
        let value = seed;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
      };
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
    },
    {
      randomSeed: deterministicRandomSeed,
      storage: deterministicStorage,
    },
  );
  await page.goto(baseUrl);
  const buildIdentityElement = page.locator('[data-build-sha]').first();
  let buildSha =
    (await buildIdentityElement.count()) > 0
      ? await buildIdentityElement.getAttribute('data-build-sha')
      : null;
  if (!buildSha) {
    const identityResponse = await page.request.get(
      new URL('/build-identity.json', baseUrl).toString(),
    );
    if (identityResponse.ok()) {
      const identity = await identityResponse.json();
      buildSha =
        typeof identity?.buildSha === 'string' ? identity.buildSha : null;
    }
  }
  if (!repositorySha || !buildSha || repositorySha !== buildSha) {
    throw new Error(
      `La captura no corresponde al checkout actual: repo=${repositorySha ?? 'n/d'}, build=${buildSha ?? 'n/d'}.`,
    );
  }
  await page.getByRole('button', { name: 'Continuar expedición' }).click();
  await page.waitForFunction(() => {
    const map = document.querySelector('[data-testid="game-map"]');
    return (
      map instanceof HTMLElement && map.dataset.roadNetworkStatus === 'ready'
    );
  });
  await page.waitForTimeout(1_000);
  const preparedRoadState = await page.evaluate(() => {
    const map = document.querySelector('[data-testid="game-map"]');
    return map instanceof HTMLElement
      ? {
          missionRouteMode: map.dataset.missionRouteMode,
          surface: map.dataset.roadContactSurface,
          edgeId: map.dataset.roadSelectedEdge,
          longitude: map.dataset.playerLongitude,
          latitude: map.dataset.playerLatitude,
          headingDegrees: map.dataset.navigationPhysicalHeading,
        }
      : null;
  });
  if (
    preparedRoadState?.missionRouteMode !== 'idle' ||
    preparedRoadState.surface !== deterministicCheckpoint.expectedSurface
  ) {
    throw new Error(
      `No se preparó el corredor determinista: ${JSON.stringify(preparedRoadState)}.`,
    );
  }
  const keepCurrentControls = page.getByRole('button', {
    name: 'Mantener controles actuales',
  });
  if ((await keepCurrentControls.count()) > 0) {
    await keepCurrentControls.click();
  }

  const joystick = page.getByLabel(/Joystick de velocidad objetivo/);
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
    path: resolve(outputDirectory, 'arcade-core-mobile-after.png'),
  });

  await page.waitForTimeout(warmupMilliseconds);

  const initial = await page.evaluate(
    ({ fallbackHeadingDegrees, initialDistanceMeters }) => {
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
      const coordinateDistanceMeters = (first, second) => {
        const radians = Math.PI / 180;
        const latitudeDelta = (second.latitude - first.latitude) * radians;
        const longitudeDelta = (second.longitude - first.longitude) * radians;
        const firstLatitude = first.latitude * radians;
        const secondLatitude = second.latitude * radians;
        const haversine =
          Math.sin(latitudeDelta / 2) ** 2 +
          Math.cos(firstLatitude) *
            Math.cos(secondLatitude) *
            Math.sin(longitudeDelta / 2) ** 2;
        return 6_371_000 * 2 * Math.asin(Math.sqrt(haversine));
      };
      window.__arcadeDynamicLoadSamples = [];
      const dynamicLoadStartedAt = performance.now();
      let previousPosition = null;
      let observedTotalDistanceMeters = initialDistanceMeters;
      const sampleDynamicLoad = () => {
        if (!(map instanceof HTMLElement)) return;
        const longitude = Number(map.dataset.playerLongitude);
        const latitude = Number(map.dataset.playerLatitude);
        const speedKilometersPerHour = Number(
          map.dataset.playerSpeedKilometersPerHour,
        );
        const targetSpeedKilometersPerHour = Number(
          map.dataset.inputTargetSpeed,
        );
        const exposedHeading = Number(map.dataset.navigationPhysicalHeading);
        if (
          !Number.isFinite(longitude) ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(speedKilometersPerHour) ||
          !Number.isFinite(targetSpeedKilometersPerHour)
        ) {
          return;
        }
        const position = { longitude, latitude };
        if (previousPosition) {
          observedTotalDistanceMeters += coordinateDistanceMeters(
            previousPosition,
            position,
          );
        }
        previousPosition = position;
        const edgeId = Number.parseInt(map.dataset.roadSelectedEdge ?? '', 10);
        window.__arcadeDynamicLoadSamples.push({
          elapsedMilliseconds: performance.now() - dynamicLoadStartedAt,
          longitude,
          latitude,
          speedKilometersPerHour,
          targetSpeedKilometersPerHour,
          headingDegrees: Number.isFinite(exposedHeading)
            ? exposedHeading
            : fallbackHeadingDegrees,
          totalDistanceMeters: observedTotalDistanceMeters,
          surface: map.dataset.roadContactSurface ?? 'unknown',
          selectedEdgeId: Number.isFinite(edgeId) ? edgeId : null,
          routeMode: map.dataset.missionRouteMode ?? 'unknown',
        });
      };
      window.__arcadeDynamicLoadSample = sampleDynamicLoad;
      sampleDynamicLoad();
      window.__arcadeDynamicLoadInterval = window.setInterval(
        sampleDynamicLoad,
        250,
      );
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
    },
    {
      fallbackHeadingDegrees: deterministicCheckpoint.headingDegrees,
      initialDistanceMeters: 1_250,
    },
  );

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
    window.__arcadeDynamicLoadSample?.();
    window.__v0251MapObserver?.disconnect();
    window.clearInterval(window.__v0251MemoryInterval);
    window.clearInterval(window.__arcadeDynamicLoadInterval);
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
      dynamicLoad: {
        samples: window.__arcadeDynamicLoadSamples ?? [],
      },
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
  const dynamicLoadSamples = metrics.dynamicLoad.samples;
  const dynamicLoadRatio = (predicate) =>
    dynamicLoadSamples.filter(predicate).length / dynamicLoadSamples.length;
  const averageDynamicSpeed =
    dynamicLoadSamples.reduce(
      (total, sample) => total + sample.speedKilometersPerHour,
      0,
    ) / dynamicLoadSamples.length;
  const dynamicDistanceMeters =
    (dynamicLoadSamples.at(-1)?.totalDistanceMeters ?? 0) -
    (dynamicLoadSamples[0]?.totalDistanceMeters ?? 0);
  const headingDistance = (first, second) =>
    Math.abs(((first - second + 540) % 360) - 180);
  const dynamicLoadContract = {
    sampleCount: dynamicLoadSamples.length,
    averageSpeedKilometersPerHour: averageDynamicSpeed,
    distanceMeters: dynamicDistanceMeters,
    trunkRatio: dynamicLoadRatio(
      (sample) => sample.surface === deterministicCheckpoint.expectedSurface,
    ),
    acceptedEdgeRatio: dynamicLoadRatio((sample) =>
      deterministicCheckpoint.acceptedEdgeIds.includes(sample.selectedEdgeId),
    ),
    idleRouteRatio: dynamicLoadRatio((sample) => sample.routeMode === 'idle'),
    alignedHeadingRatio: dynamicLoadRatio(
      (sample) =>
        headingDistance(
          sample.headingDegrees,
          deterministicCheckpoint.headingDegrees,
        ) <= 8,
    ),
  };
  if (
    dynamicLoadContract.sampleCount < 80 ||
    dynamicLoadContract.averageSpeedKilometersPerHour < 52 ||
    dynamicLoadContract.averageSpeedKilometersPerHour > 70 ||
    dynamicLoadContract.distanceMeters < 2_400 ||
    dynamicLoadContract.distanceMeters > 3_200 ||
    dynamicLoadContract.trunkRatio < 0.95 ||
    dynamicLoadContract.acceptedEdgeRatio < 0.9 ||
    dynamicLoadContract.idleRouteRatio < 0.95 ||
    dynamicLoadContract.alignedHeadingRatio < 0.9
  ) {
    throw new Error(
      `La carga dinámica abandonó el corredor determinista: ${JSON.stringify(dynamicLoadContract)}.`,
    );
  }
  if (
    metrics.mapDataset.roadNetworkStatus !== 'ready' ||
    metrics.mapDataset.missionRouteMode !== 'idle' ||
    metrics.mapDataset.roadContactSurface !==
      deterministicCheckpoint.expectedSurface
  ) {
    throw new Error(
      'El escenario vial cambió de red o ruta durante la captura.',
    );
  }
  metrics.captureMetadata = {
    schemaVersion: captureSchemaVersion,
    measuredSha: buildSha,
    repositorySha,
    buildSha,
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
      id: 'arcade-core-trunk-cruise-v2',
      viewport: referenceViewport,
      deviceScaleFactor: referenceDeviceScaleFactor,
      warmupMilliseconds,
      observationMilliseconds,
      touchGesture: {
        source: 'cdp-touch',
        verticalTravelJoystickRatio: 0.44,
        targetKilometersPerHour: 58,
      },
      storage: {
        gameSaveVersion: deterministicStorage.save.version,
        settingsVersion: deterministicStorage.settings.version,
      },
      onboarding: 'completed-save',
      controlMode: 'target-speed-joystick',
      randomSeed: deterministicRandomSeed,
      checkpoint: deterministicCheckpoint,
      route: { kind: 'none', expectedMode: 'idle' },
      roadNetworkStatus: metrics.mapDataset.roadNetworkStatus,
      missionRouteMode: metrics.mapDataset.missionRouteMode,
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
      path: resolve(outputDirectory, `arcade-core-mobile-${viewport.name}.png`),
    });
  }
  await session.detach();
  await context.close();
} finally {
  await browser.close();
}

console.log(`Driving UX capture written to ${outputDirectory}`);

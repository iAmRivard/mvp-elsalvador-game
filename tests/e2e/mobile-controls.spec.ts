import {
  expect,
  type CDPSession,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

const settingsKey = 'el-salvador-rutas-perdidas:settings';

async function startFreshExpedition(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  const beginMission = page.getByRole('button', {
    name: /Comenzar investigación/,
  });
  await expect(beginMission).toBeVisible();
  await beginMission.click();
  const skipTutorial = page.getByRole('button', { name: 'Omitir' });
  await expect(skipTutorial).toBeVisible();
  await skipTutorial.click();
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-road-network-status',
    'ready',
    { timeout: 20_000 },
  );
}

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
    width: box!.width,
  };
}

async function steerTowardRoute(
  page: Page,
  session: CDPSession,
  joystickCenter: Awaited<ReturnType<typeof centerOf>>,
  touchId: number,
): Promise<void> {
  const gameMap = page.getByTestId('game-map');
  const recommended = Number(
    await gameMap.getAttribute('data-navigation-recommended-heading'),
  );
  const physical = Number(
    await gameMap.getAttribute('data-navigation-physical-heading'),
  );
  const shortestHeadingDelta = ((recommended - physical + 540) % 360) - 180;
  const headingDelta =
    Math.abs(shortestHeadingDelta) >= 170
      ? Math.abs(shortestHeadingDelta)
      : shortestHeadingDelta;
  if (!Number.isFinite(headingDelta) || Math.abs(headingDelta) <= 4) {
    await page.waitForTimeout(180);
    return;
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: touchId, x: joystickCenter.x, y: joystickCenter.y, force: 1 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: touchId,
        x:
          joystickCenter.x +
          (headingDelta >= 0 ? 1 : -1) * joystickCenter.width * 0.48,
        y: joystickCenter.y,
        force: 1,
      },
    ],
  });
  await page.waitForTimeout(220);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.waitForTimeout(70);
}

async function openPauseSettings(page: Page) {
  await page.getByRole('button', { name: 'Pausar partida' }).click();
  const pauseMenu = page.getByRole('dialog', { name: 'Partida en pausa' });
  await expect(pauseMenu).toBeVisible();
  await pauseMenu.getByRole('button', { name: 'Configuración' }).click();
  const settings = page.getByRole('dialog', { name: 'Configuración' });
  await expect(settings).toBeVisible();
  return { pauseMenu, settings };
}

test('Arcade arranca de inmediato, mantiene crucero y usa reversa segura', async ({
  context,
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-mobile'));
  await startFreshExpedition(page);

  const gameMap = page.getByTestId('game-map');
  await expect(page.getByLabel('Controles táctiles')).toHaveAttribute(
    'data-control-mode',
    'arcade-driving',
  );
  await expect(page.getByRole('button', { name: 'Acelerar' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Frenar o retroceder' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Activar crucero' }),
  ).toHaveCount(0);
  await expect(page.getByTestId('mobile-cruise-target')).toContainText(
    'OBJETIVO 0 km/h',
  );

  const joystick = page.getByLabel('Joystick de conducción arcade');
  const joystickCenter = await centerOf(joystick);
  const session = await context.newCDPSession(page);
  const initialPosition = await gameMap.evaluate(
    (element) =>
      `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
  );
  const movementStartedAt = Date.now();
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 1, x: joystickCenter.x, y: joystickCenter.y, force: 1 },
    ],
  });
  const touchMoveDispatchStartedAt = Date.now();
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 1,
        x: joystickCenter.x,
        y: joystickCenter.y - joystickCenter.width * 0.44,
        force: 1,
      },
    ],
  });
  await expect
    .poll(
      () =>
        gameMap.evaluate(
          (element) =>
            `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
        ),
      { timeout: 1_000, intervals: [16, 25, 50] },
    )
    .not.toBe(initialPosition);
  const wallClockFirstPositionMilliseconds =
    Date.now() - touchMoveDispatchStartedAt;
  const visibleMovementMilliseconds = Date.now() - movementStartedAt;
  expect(visibleMovementMilliseconds).toBeLessThan(1_000);
  await expect(gameMap).toHaveAttribute(
    'data-input-consumption-to-position-latency-ms',
    /^\d+(?:\.\d+)?$/,
  );
  await expect(gameMap).toHaveAttribute(
    'data-input-consumption-to-visual-latency-ms',
    /^\d+(?:\.\d+)?$/,
  );
  const firstPositionMilliseconds = Number(
    await gameMap.getAttribute('data-input-consumption-to-position-latency-ms'),
  );
  const firstVisualMilliseconds = Number(
    await gameMap.getAttribute('data-input-consumption-to-visual-latency-ms'),
  );
  const inputPipeline = {
    eventToStoredMilliseconds: Number(
      await gameMap.getAttribute('data-input-stored-latency-ms'),
    ),
    eventToConsumedMilliseconds: Number(
      await gameMap.getAttribute('data-input-consumption-latency-ms'),
    ),
    eventToFirstPositionMilliseconds: Number(
      await gameMap.getAttribute('data-input-first-position-latency-ms'),
    ),
    eventToFirstVisualMilliseconds: Number(
      await gameMap.getAttribute('data-input-first-visual-latency-ms'),
    ),
  };
  expect(firstPositionMilliseconds).toBeLessThan(250);
  expect(firstVisualMilliseconds).toBeLessThan(1_000);
  await expect
    .poll(async () =>
      Number(await gameMap.getAttribute('data-input-target-speed')),
    )
    .toBeGreaterThanOrEqual(25);
  await expect(gameMap).toHaveAttribute('data-drive-enabled', 'true');
  await expect(gameMap).toHaveAttribute('data-runtime-blocked-by', '');

  const speedMilestones: Record<'10' | '20' | '30', number> = {
    '10': 0,
    '20': 0,
    '30': 0,
  };
  for (const threshold of [10, 20, 30] as const) {
    await expect
      .poll(
        async () =>
          Number(
            await gameMap.getAttribute('data-player-speed-kilometers-per-hour'),
          ),
        { timeout: 3_000, intervals: [16, 25, 50] },
      )
      .toBeGreaterThanOrEqual(threshold);
    speedMilestones[String(threshold) as '10' | '20' | '30'] =
      Date.now() - movementStartedAt;
  }
  expect(speedMilestones['10']).toBeLessThan(1_000);
  expect(speedMilestones['20']).toBeLessThan(2_000);
  expect(speedMilestones['30']).toBeLessThan(3_000);
  await testInfo.attach('arcade-movement-metrics.json', {
    body: JSON.stringify(
      {
        firstPositionMilliseconds,
        firstVisualMilliseconds,
        wallClockFirstPositionMilliseconds,
        visibleMovementMilliseconds,
        inputPipeline,
        speedMilestones,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  await expect(page.locator('.map-frame')).toHaveAttribute(
    'data-player-renderer',
    /^(ready|fallback)$/,
  );
  const positionWhenReleased = await gameMap.evaluate(
    (element) =>
      `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
  );
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await page.waitForTimeout(180);
  const targetAfterRelease = Number(
    await gameMap.getAttribute('data-input-target-speed'),
  );
  await page.waitForTimeout(650);
  const heldTarget = Number(
    await gameMap.getAttribute('data-input-target-speed'),
  );
  expect(Math.abs(heldTarget - targetAfterRelease)).toBeLessThan(1);
  await expect
    .poll(() =>
      gameMap.evaluate(
        (element) =>
          `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
      ),
    )
    .not.toBe(positionWhenReleased);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 2, x: joystickCenter.x, y: joystickCenter.y, force: 1 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 2,
        x: joystickCenter.x + joystickCenter.width * 0.44,
        y: joystickCenter.y,
        force: 1,
      },
    ],
  });
  await expect
    .poll(async () => Number(await gameMap.getAttribute('data-input-turn')))
    .toBeGreaterThan(0.2);
  await page.waitForTimeout(400);
  expect(
    Math.abs(
      Number(await gameMap.getAttribute('data-input-target-speed')) -
        heldTarget,
    ),
  ).toBeLessThan(1);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(gameMap).toHaveAttribute('data-input-turn', '0.000');

  await page.getByRole('button', { name: 'Turbo' }).click();
  await expect(gameMap).toHaveAttribute('data-input-mobile-boost', 'active');
  await expect(gameMap).toHaveAttribute('data-input-boost', 'true');
  await page.waitForTimeout(2_650);
  await expect(gameMap).not.toHaveAttribute(
    'data-input-mobile-boost',
    'active',
  );
  expect(
    Math.abs(
      Number(await gameMap.getAttribute('data-input-target-speed')) -
        heldTarget,
    ),
  ).toBeLessThan(1);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 3, x: joystickCenter.x, y: joystickCenter.y, force: 1 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 3,
        x: joystickCenter.x,
        y: joystickCenter.y + joystickCenter.width * 0.44,
        force: 1,
      },
    ],
  });
  await expect
    .poll(
      async () => Number(await gameMap.getAttribute('data-input-target-speed')),
      { timeout: 5_000 },
    )
    .toBeLessThan(0.6);
  await expect(gameMap).toHaveAttribute('data-input-cruise-braking', 'true');
  await expect(gameMap).toHaveAttribute(
    'data-input-cruise-reverse-state',
    'awaiting-release',
    {
      timeout: 6_000,
    },
  );
  await page.waitForTimeout(700);
  await expect(gameMap).toHaveAttribute('data-input-cruise-reversing', 'false');
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(gameMap).toHaveAttribute(
    'data-input-cruise-reverse-state',
    'reverse-armed',
  );
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 4, x: joystickCenter.x, y: joystickCenter.y, force: 1 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 4,
        x: joystickCenter.x,
        y: joystickCenter.y + joystickCenter.width * 0.44,
        force: 1,
      },
    ],
  });
  await expect(gameMap).toHaveAttribute('data-input-cruise-reversing', 'true', {
    timeout: 6_000,
  });
  await expect
    .poll(async () => Number(await gameMap.getAttribute('data-input-throttle')))
    .toBeLessThan(0);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await page.getByRole('button', { name: 'Pausar partida' }).click();
  await expect(gameMap).toHaveAttribute('data-input-target-speed', '0.0');
  await expect(gameMap).toHaveAttribute('data-input-turn', '0.000');
  await expect(gameMap).toHaveAttribute('data-input-pointer-active', 'false');
  await session.detach();
});

test('el fallback vial compartido nunca deja el runtime esperando', async ({
  context,
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-mobile'));
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    const NativeWorker = window.Worker;
    window.Worker = class FirstRoadRouteNullWorker extends NativeWorker {
      private returnedNullRoute = false;

      postMessage(
        message: unknown,
        options?: StructuredSerializeOptions | Transferable[],
      ): void {
        if (
          !this.returnedNullRoute &&
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'calculate-route' &&
          'requestId' in message &&
          typeof message.requestId === 'string'
        ) {
          this.returnedNullRoute = true;
          document.documentElement.dataset.firstRoadRouteNullInjected = 'true';
          const requestId = message.requestId;
          queueMicrotask(() => {
            this.dispatchEvent(
              new MessageEvent('message', {
                data: {
                  type: 'route-calculated',
                  requestId,
                  route: null,
                  durationMilliseconds: 0,
                  diagnostics: {
                    calculations: 1,
                    cacheHits: 0,
                    cacheEntries: 0,
                    averageDurationMilliseconds: 0,
                    lastDurationMilliseconds: 0,
                    lastExpandedNodeCount: 0,
                  },
                },
              }),
            );
          });
          return;
        }
        if (Array.isArray(options)) {
          super.postMessage(message, options);
        } else {
          super.postMessage(message, options);
        }
      }
    };
  });
  let releaseRoadRequest: () => void = () => {};
  const roadRequestRelease = new Promise<void>((resolve) => {
    releaseRoadRequest = resolve;
  });
  await page.route('**/data/roads/western-corridor.json', async (route) => {
    const response = await route.fetch();
    await roadRequestRelease;
    await route.fulfill({ response });
  });
  await page.goto('/');

  const start = page.getByRole('button', { name: 'Comenzar expedición' });
  await expect(start).toBeDisabled();
  await expect(
    page.getByText(/modo compatible sin asistencia vial completa/i),
  ).toBeVisible({ timeout: 12_000 });
  await expect(start).toBeEnabled();
  await start.click();
  const narrative = page.getByRole('dialog', { name: 'Una señal de auxilio' });
  await expect(narrative).toBeVisible();
  await narrative
    .getByRole('button', { name: /Comenzar investigación/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Elige tu velocidad' }),
  ).toBeVisible();

  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute(
    'data-road-network-status',
    'unavailable',
  );
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'fallback');
  await expect(gameMap).toHaveAttribute(
    'data-navigation-recommended-heading',
    /\d/,
  );
  await expect(gameMap).toHaveAttribute('data-navigation-route-segment', '0');
  await expect
    .poll(() =>
      gameMap.getAttribute('data-navigation-distance-to-route').then(Number),
    )
    .toBeLessThanOrEqual(24);
  await expect(gameMap).toHaveAttribute('data-drive-enabled', 'true');
  await expect(gameMap).toHaveAttribute('data-runtime-blocked-by', '');
  const joystickCenter = await centerOf(
    page.getByLabel('Joystick de conducción arcade'),
  );
  const session = await context.newCDPSession(page);
  const drag = async (id: number, x: number, y: number) => {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id, x: joystickCenter.x, y: joystickCenter.y, force: 1 }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id, x, y, force: 1 }],
    });
  };
  const release = () =>
    session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

  await drag(
    40,
    joystickCenter.x,
    joystickCenter.y - joystickCenter.width * 0.44,
  );
  await expect
    .poll(() =>
      gameMap
        .getAttribute('data-player-speed-kilometers-per-hour')
        .then(Number),
    )
    .toBeGreaterThanOrEqual(15);
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'steer',
  );
  await release();

  const headingBeforeTurn = Number(
    await gameMap.getAttribute('data-navigation-physical-heading'),
  );
  await drag(
    41,
    joystickCenter.x + joystickCenter.width * 0.55,
    joystickCenter.y,
  );
  await expect
    .poll(async () => {
      const heading = Number(
        await gameMap.getAttribute('data-navigation-physical-heading'),
      );
      return Math.abs(((heading - headingBeforeTurn + 540) % 360) - 180);
    })
    .toBeGreaterThanOrEqual(4);
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'coast',
  );
  await release();
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'brake',
    { timeout: 4_000 },
  );

  await drag(
    42,
    joystickCenter.x,
    joystickCenter.y + joystickCenter.width * 0.44,
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'route',
    { timeout: 8_000 },
  );
  await expect(
    page.getByRole('heading', { name: 'Esperando la línea cian' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'La guía directa no completa este paso. Espera la línea cian o toca Omitir.',
    ),
  ).toBeVisible();
  await release();
  await expect(gameMap).toHaveAttribute(
    'data-input-cruise-reverse-state',
    'reverse-armed',
  );

  const positionBeforeRouteFollow = await gameMap.evaluate(
    (element) =>
      `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
  );
  await drag(
    43,
    joystickCenter.x,
    joystickCenter.y - joystickCenter.width * 0.24,
  );
  await expect
    .poll(() => gameMap.getAttribute('data-input-target-speed').then(Number), {
      timeout: 1_000,
      intervals: [16, 25, 50],
    })
    .toBeGreaterThanOrEqual(15);
  await expect(gameMap).toHaveAttribute(
    'data-input-cruise-reverse-state',
    'forward',
  );
  await release();
  await expect
    .poll(
      () =>
        gameMap.evaluate(
          (element) =>
            `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
        ),
      { timeout: 1_000, intervals: [16, 25, 50] },
    )
    .not.toBe(positionBeforeRouteFollow);
  await expect
    .poll(() =>
      gameMap
        .getAttribute('data-player-speed-kilometers-per-hour')
        .then(Number),
    )
    .toBeGreaterThanOrEqual(5);
  const tutorialCard = page.locator('[data-tutorial-card="mobile"]');
  await page.waitForTimeout(1_400);
  await expect(tutorialCard).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'route',
  );
  if (testInfo.project.name === 'chromium-mobile-landscape') {
    const actionHint = page.locator('.mobile-tutorial-card__action-hint');
    const [cardBox, actionHintBox] = await Promise.all([
      tutorialCard.boundingBox(),
      actionHint.boundingBox(),
    ]);
    expect(cardBox).not.toBeNull();
    expect(actionHintBox).not.toBeNull();
    expect(actionHintBox!.y).toBeGreaterThanOrEqual(cardBox!.y);
    expect(actionHintBox!.y + actionHintBox!.height).toBeLessThanOrEqual(
      cardBox!.y + cardBox!.height + 0.5,
    );
    await page.getByRole('button', { name: 'Omitir' }).click();
    await expect(tutorialCard).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute(
      'data-tutorial-target',
      /.+/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-mission-route-mode',
      'fallback',
    );
    const activeMissionButton = page.getByRole('button', {
      name: 'Abrir bitácora de la misión',
    });
    await expect(activeMissionButton).toBeVisible();
    await expect(activeMissionButton).toContainText(
      'Acércate al marcador y escucha la señal',
    );
    await expect(
      page.getByRole('button', { name: 'Pausar partida' }),
    ).toBeVisible();
    await expect(gameMap).toHaveAttribute('data-drive-enabled', 'true');
    await expect(gameMap).toHaveAttribute('data-runtime-blocked-by', '');
    await session.detach();
    return;
  }
  await drag(
    90,
    joystickCenter.x,
    joystickCenter.y - joystickCenter.width * 0.24,
  );
  await expect(gameMap).toHaveAttribute('data-input-pointer-active', 'true');
  const targetBeforePromotion = Number(
    await gameMap.getAttribute('data-input-target-speed'),
  );
  releaseRoadRequest();
  await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready', {
    timeout: 20_000,
  });
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road', {
    timeout: 20_000,
  });
  await expect(
    page.getByRole('heading', { name: 'Sigue la línea cian' }),
  ).toBeVisible();
  const promotionObservation = await gameMap.evaluate(async (element) => {
    const positionFor = () =>
      `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`;
    const positionAtPromotion = positionFor();
    const observationStartedAt = performance.now();
    while (
      positionFor() === positionAtPromotion &&
      performance.now() - observationStartedAt < 250
    ) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
    return {
      promoted: element.dataset.roadNetworkPromotedFromFallback,
      assistRamp: element.dataset.roadPromotionAssistRamp,
      pointerActive: element.dataset.inputPointerActive,
      targetSpeed: Number(element.dataset.inputTargetSpeed),
      positionChanged: positionFor() !== positionAtPromotion,
    };
  });
  expect(promotionObservation).toMatchObject({
    promoted: 'true',
    assistRamp: 'active',
    pointerActive: 'true',
    positionChanged: true,
  });
  expect(promotionObservation.targetSpeed).toBeGreaterThanOrEqual(
    targetBeforePromotion,
  );
  await release();

  if (testInfo.project.name === 'chromium-mobile') {
    await page.getByRole('button', { name: 'Pausar partida' }).click();
    const resumeButton = page.getByRole('button', {
      name: 'Reanudar partida',
    });
    await expect(resumeButton).toBeVisible();
    await page.waitForTimeout(1_600);
    await expect(gameMap).toHaveAttribute(
      'data-road-promotion-assist-ramp',
      'active',
    );
    const pausedAssistElapsedMilliseconds = Number(
      await gameMap.getAttribute(
        'data-road-promotion-assist-paused-elapsed-ms',
      ),
    );
    expect(pausedAssistElapsedMilliseconds).toBeGreaterThanOrEqual(0);
    await resumeButton.click();
    await expect(gameMap).toHaveAttribute(
      'data-road-promotion-assist-resumed-elapsed-ms',
      /^\d+(?:\.\d+)?$/,
    );
    const resumedAssistElapsedMilliseconds = Number(
      await gameMap.getAttribute(
        'data-road-promotion-assist-resumed-elapsed-ms',
      ),
    );
    expect(resumedAssistElapsedMilliseconds).toBe(
      pausedAssistElapsedMilliseconds,
    );
    await expect(gameMap).toHaveAttribute(
      'data-road-promotion-assist-resumed-ramp',
      'active',
    );
    await expect(gameMap).toHaveAttribute(
      'data-road-promotion-assist-ramp',
      'complete',
      { timeout: 4_000 },
    );
  }

  await expect(gameMap).toHaveAttribute(
    'data-road-promotion-first-active-assist-multiplier',
    '0.000',
  );
  await expect(gameMap).toHaveAttribute(
    'data-initial-road-alignment-outcome',
    'preserved-runtime',
  );
  await expect(gameMap).toHaveAttribute(
    'data-initial-road-alignment-revision-delta',
    '0',
  );
  await expect(gameMap).toHaveAttribute(
    'data-road-promotion-runtime-displacement-meters',
    '0.000',
  );
  await expect(gameMap).toHaveAttribute(
    'data-road-promotion-runtime-heading-delta',
    '0.000',
  );
  await expect(gameMap).toHaveAttribute(
    'data-road-promotion-runtime-speed-delta-kph',
    '0.000',
  );
  await expect(gameMap).toHaveAttribute(
    'data-road-promotion-input-target-delta-kph',
    '0.000',
  );
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road', {
    timeout: 20_000,
  });
  await expect(page.locator('html')).toHaveAttribute(
    'data-first-road-route-null-injected',
    'true',
  );
  await expect(gameMap).toHaveAttribute(
    'data-route-fallback-road-retry-attempts',
    '0',
  );
  await expect
    .poll(() =>
      gameMap
        .getAttribute('data-route-fallback-road-resolved-attempts')
        .then(Number),
    )
    .toBeGreaterThanOrEqual(1);
  const positionBeforeRoadFollow = await gameMap.evaluate(
    (element) =>
      `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
  );
  await drag(
    91,
    joystickCenter.x,
    joystickCenter.y - joystickCenter.width * 0.24,
  );
  await expect
    .poll(() => gameMap.getAttribute('data-input-target-speed').then(Number), {
      timeout: 1_000,
      intervals: [16, 25, 50],
    })
    .toBeGreaterThanOrEqual(25);
  await release();
  await expect
    .poll(
      () =>
        gameMap.evaluate(
          (element) =>
            `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
        ),
      { timeout: 1_000, intervals: [16, 25, 50] },
    )
    .not.toBe(positionBeforeRoadFollow);
  await expect(gameMap).toHaveAttribute('data-drive-enabled', 'true');
  await expect(gameMap).toHaveAttribute('data-runtime-blocked-by', '');
  const roadFollowIsInvalid = async () => {
    const [offRoute, requiresRejoin, surface, recommended, physical] =
      await Promise.all([
        gameMap.getAttribute('data-navigation-off-route'),
        gameMap.getAttribute('data-navigation-requires-rejoin'),
        gameMap.getAttribute('data-road-contact-surface'),
        gameMap
          .getAttribute('data-navigation-recommended-heading')
          .then(Number),
        gameMap.getAttribute('data-navigation-physical-heading').then(Number),
      ]);
    const headingDifference = Math.abs(
      ((recommended - physical + 540) % 360) - 180,
    );
    return (
      offRoute === 'true' ||
      requiresRejoin === 'true' ||
      surface === 'offroad' ||
      !Number.isFinite(headingDifference) ||
      headingDifference > 18
    );
  };
  let roadSteeringTouchId = 92;
  const roadFollowDeadline = Date.now() + 5_000;
  while ((await roadFollowIsInvalid()) && Date.now() < roadFollowDeadline) {
    await steerTowardRoute(page, session, joystickCenter, roadSteeringTouchId);
    roadSteeringTouchId += 1;
  }
  await expect(gameMap).toHaveAttribute('data-navigation-off-route', 'false');
  await expect(gameMap).toHaveAttribute(
    'data-navigation-requires-rejoin',
    'false',
  );
  await expect(gameMap).not.toHaveAttribute(
    'data-road-contact-surface',
    'offroad',
  );
  await expect.poll(roadFollowIsInvalid).toBe(false);
  await expect(tutorialCard).toHaveCount(0, { timeout: 3_000 });
  await expect(page.getByTestId('mobile-driving-hud')).toBeVisible();
  await session.detach();
});

test('persiste modos alternativos y limpia entradas al pausar', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-mobile'));
  await startFreshExpedition(page);
  const gameMap = page.getByTestId('game-map');

  let { pauseMenu, settings } = await openPauseSettings(page);
  await settings.getByText('Joystick y pedales', { exact: true }).click();
  await settings.getByText('Grande', { exact: true }).click();
  await settings
    .getByRole('slider', { name: 'Zona muerta del joystick' })
    .fill('0.2');
  await settings.getByText('Directa', { exact: true }).click();
  await settings.getByRole('button', { name: 'Listo' }).click();
  await pauseMenu.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByLabel('Controles táctiles')).toHaveAttribute(
    'data-control-mode',
    'joystick-pedals',
  );
  await expect(page.getByRole('button', { name: 'Acelerar' })).toBeVisible();

  ({ pauseMenu, settings } = await openPauseSettings(page));
  await settings.getByText('Botones clásicos', { exact: true }).click();
  await settings.getByRole('button', { name: 'Listo' }).click();
  await pauseMenu.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByLabel('Dirección clásica')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avanzar' })).toBeVisible();

  const persistedSettings = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed;
  }, settingsKey);
  expect(persistedSettings).toMatchObject({
    version: 9,
    settings: {
      controlMode: 'classic-buttons',
      joystickSize: 'large',
      joystickDeadZone: 0.2,
      steeringSensitivity: 'high',
      autoThrottleDefault: false,
    },
  });

  await page.reload();
  await page
    .getByRole('button', { name: /^(Comenzar|Continuar) expedición$/ })
    .click();
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
  await expect(page.getByLabel('Dirección clásica')).toBeVisible();
  await page.getByRole('button', { name: 'Pausar partida' }).click();
  await expect(gameMap).toHaveAttribute('data-input-throttle', '0.000');
  await expect(gameMap).toHaveAttribute('data-input-mobile-boost', 'off');
});

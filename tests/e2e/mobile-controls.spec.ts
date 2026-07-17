import { expect, type Locator, type Page, test } from '@playwright/test';

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
    await gameMap.getAttribute(
      'data-input-consumption-to-position-latency-ms',
    ),
  );
  const firstVisualMilliseconds = Number(
    await gameMap.getAttribute(
      'data-input-consumption-to-visual-latency-ms',
    ),
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
            await gameMap.getAttribute(
              'data-player-speed-kilometers-per-hour',
            ),
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
  test.setTimeout(30_000);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.route('**/data/roads/western-corridor.json', async () => {
    await new Promise<void>(() => undefined);
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
  await expect(gameMap).toHaveAttribute('data-drive-enabled', 'true');
  await expect(gameMap).toHaveAttribute('data-runtime-blocked-by', '');
  const joystickCenter = await centerOf(
    page.getByLabel('Joystick de conducción arcade'),
  );
  const session = await context.newCDPSession(page);
  const drag = async (id: number, x: number, y: number) => {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { id, x: joystickCenter.x, y: joystickCenter.y, force: 1 },
      ],
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
    page.getByRole('heading', { name: 'Sigue la guía directa' }),
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
    joystickCenter.y - joystickCenter.width * 0.44,
  );
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
  await expect(page.locator('[data-tutorial-card="mobile"]')).toHaveCount(0, {
    timeout: 5_000,
  });
  await expect(page.getByTestId('mobile-driving-hud')).toBeVisible();
  await release();
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

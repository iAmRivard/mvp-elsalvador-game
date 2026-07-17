import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

interface ViewportCase {
  name: string;
  width: number;
  height: number;
}

const viewports: ViewportCase[] = [
  { name: 'reference-392', width: 392, height: 850 },
  { name: 'portrait', width: 412, height: 850 },
  { name: 'landscape', width: 850, height: 412 },
  { name: 'tablet', width: 768, height: 1_024 },
  { name: 'small', width: 360, height: 640 },
];

async function enterExpedition(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  const beginMission = page.getByRole('button', {
    name: /Comenzar investigación/,
  });
  if (await beginMission.isVisible()) await beginMission.click();
  const skipTutorial = page.getByRole('button', { name: 'Omitir' });
  if (await skipTutorial.isVisible()) await skipTutorial.click();
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-road-network-status',
    /ready|unavailable/,
    { timeout: 25_000 },
  );
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 25_000,
  });
  const closeRadio = page.getByRole('button', { name: 'Cerrar transmisión' });
  if (await closeRadio.isVisible()) await closeRadio.click();
}

async function selectMobileTarget(
  context: BrowserContext,
  page: Page,
  targetSpeedKilometersPerHour: number,
  touchId: number,
) {
  const joystick = page.getByLabel('Joystick de velocidad objetivo');
  await expect(joystick).toBeVisible();
  const box = await joystick.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  const session = await context.newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: touchId, x: centerX, y: centerY, force: 1 }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          id: touchId,
          x: centerX,
          y: centerY - box!.width * 0.44,
          force: 1,
        },
      ],
    });
    await expect(page.getByTestId('mobile-driving-hud')).toBeVisible({
      timeout: 10_000,
    });
    await expect
      .poll(
        () =>
          page
            .getByTestId('game-map')
            .getAttribute('data-input-target-speed')
            .then(Number),
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(targetSpeedKilometersPerHour);
  } finally {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  }
}

async function selectFastMobileTarget(context: BrowserContext, page: Page) {
  await selectMobileTarget(context, page, 88, 1);
  await expect
    .poll(
      async () =>
        Number.parseFloat(
          (await page.getByTestId('mobile-driving-speed').textContent()) ?? '0',
        ),
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(58);
}

async function expectAppliedCameraOffset(
  gameMap: Locator,
  expectedOffsetY: number,
) {
  await expect(gameMap).toHaveAttribute(
    'data-follow-offset-y',
    String(expectedOffsetY),
  );
  await expect(gameMap).toHaveAttribute(
    'data-camera-last-applied-offset-y',
    String(expectedOffsetY),
  );
  await expect(gameMap).toHaveAttribute(
    'data-camera-last-operation',
    /^(easeTo|jumpTo-offset-center)$/,
  );
  await expect
    .poll(async () => {
      const actual = Number(
        await gameMap.getAttribute('data-camera-applied-screen-offset-y'),
      );
      return Math.abs(actual - expectedOffsetY);
    })
    .toBeLessThanOrEqual(1);
}

async function stopMobileTarget(context: BrowserContext, page: Page) {
  const joystick = page.getByLabel('Joystick de velocidad objetivo');
  await expect(joystick).toBeVisible();
  const box = await joystick.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  const session = await context.newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 2, x: centerX, y: centerY, force: 1 }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          id: 2,
          x: centerX,
          y: centerY + box!.width * 0.44,
          force: 1,
        },
      ],
    });
    await expect
      .poll(
        async () =>
          Number(
            await page
              .getByTestId('game-map')
              .getAttribute('data-player-speed-kilometers-per-hour'),
          ),
        { timeout: 20_000 },
      )
      .toBeLessThan(2);
  } finally {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  }
}

for (const viewport of viewports) {
  test(`respeta el presupuesto de conducción en ${viewport.name}`, async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile');
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.addInitScript(() => window.localStorage.clear());
    await enterExpedition(page);

    await selectFastMobileTarget(context, page);
    const drivingHud = page.getByTestId('mobile-driving-hud');
    const gameMap = page.getByTestId('game-map');
    await expect(gameMap).toHaveAttribute('data-presentation-mode', 'fast');
    await expect(gameMap).toHaveAttribute('data-map-declutter-profile', 'fast');
    await expect(gameMap).toHaveAttribute(
      'data-current-camera-profile',
      'mobileFast',
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-average-update-ms',
      /^\d+\.\d{3}$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-requested-updates',
      /^[1-9]\d*$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-applied-updates',
      /^[1-9]\d*$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-skipped-by-interval',
      /^\d+$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-skipped-by-tolerance',
      /^\d+$/,
    );
    await expect(gameMap).not.toHaveAttribute(
      'data-camera-p95-update-ms',
      /.+/,
    );
    await expect(gameMap).not.toHaveAttribute(
      'data-rendered-symbol-count',
      /.+/,
    );

    await expect(page.locator('.player-hud')).toBeHidden();
    await expect(page.getByTestId('mobile-mini-navigator')).toBeHidden();
    await expect(page.locator('.mission-route-arrow')).toBeVisible();

    const [hudBox, joystickBox, actionsBox] = await Promise.all([
      drivingHud.boundingBox(),
      page.getByLabel('Joystick de velocidad objetivo').boundingBox(),
      page.locator('.touch-actions').boundingBox(),
    ]);
    expect(hudBox).not.toBeNull();
    expect(joystickBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();

    for (const box of [hudBox!, joystickBox!, actionsBox!]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }

    const controlsTop = Math.min(joystickBox!.y, actionsBox!.y);
    const lowerControlRatio = (viewport.height - controlsTop) / viewport.height;
    const upperHudRatio = hudBox!.height / viewport.height;
    const usefulMapRatio = 1 - upperHudRatio - lowerControlRatio;
    expect(upperHudRatio).toBeLessThanOrEqual(0.17);
    expect(lowerControlRatio).toBeLessThanOrEqual(0.27);
    expect(usefulMapRatio).toBeGreaterThanOrEqual(0.58);
    expect(hudBox!.y + hudBox!.height).toBeLessThan(controlsTop);

    const totalLayers = Number(
      await gameMap.getAttribute('data-map-layer-count'),
    );
    const visibleLayers = Number(
      await gameMap.getAttribute('data-map-visible-layer-count'),
    );
    expect(totalLayers).toBeGreaterThan(0);
    expect(visibleLayers).toBeGreaterThan(0);
    expect(visibleLayers).toBeLessThan(totalLayers);

    await testInfo.attach(`v0.2.5.3-${viewport.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
}

test('aplica offsets reales en stopped, driving, fast y stopped', async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await page.setViewportSize({ width: 392, height: 850 });
  await page.addInitScript(() => window.localStorage.clear());
  await enterExpedition(page);

  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute(
    'data-current-camera-profile',
    'mobileStopped',
  );
  await expectAppliedCameraOffset(gameMap, 162);

  await selectMobileTarget(context, page, 30, 3);
  await expect(gameMap).toHaveAttribute(
    'data-current-camera-profile',
    'mobileDriving',
    { timeout: 8_000 },
  );
  await expectAppliedCameraOffset(gameMap, 204);

  await selectFastMobileTarget(context, page);
  await expect(gameMap).toHaveAttribute(
    'data-current-camera-profile',
    'mobileFast',
    { timeout: 12_000 },
  );
  await expectAppliedCameraOffset(gameMap, 220);

  await stopMobileTarget(context, page);
  await expect(gameMap).toHaveAttribute(
    'data-current-camera-profile',
    'mobileStopped',
    { timeout: 4_000 },
  );
  await expectAppliedCameraOffset(gameMap, 162);
  await expect
    .poll(() =>
      gameMap.getAttribute('data-camera-profile-transitions').then(Number),
    )
    .toBeGreaterThanOrEqual(3);
});

test('recalcula y aplica el offset al cambiar el viewport', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await page.setViewportSize({ width: 392, height: 850 });
  await page.addInitScript(() => window.localStorage.clear());
  await enterExpedition(page);

  const gameMap = page.getByTestId('game-map');
  await expectAppliedCameraOffset(gameMap, 162);
  await page.setViewportSize({ width: 392, height: 700 });
  await expectAppliedCameraOffset(gameMap, 133);
});

test('no actualiza continuamente el marcador fallback oculto', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await page.addInitScript(() => window.localStorage.clear());
  await enterExpedition(page);

  const mapFrame = page.locator('.map-frame');
  await expect(mapFrame).toHaveAttribute('data-player-renderer', 'ready', {
    timeout: 20_000,
  });
  await expect(page.locator('.player-marker')).toHaveClass(
    /player-marker--fallback-hidden/,
  );
  const gameMap = page.getByTestId('game-map');
  await page.waitForTimeout(1_100);
  const initialFallbackUpdates = Number(
    await gameMap.getAttribute('data-camera-fallback-marker-updates'),
  );
  const initialThreeUpdates = Number(
    await gameMap.getAttribute('data-camera-three-player-updates'),
  );
  const initialEffectsUpdates = Number(
    await gameMap.getAttribute('data-three-driving-effects-updates'),
  );

  await page.waitForTimeout(1_100);
  expect(
    Number(
      await gameMap.getAttribute('data-camera-fallback-marker-updates'),
    ),
  ).toBe(initialFallbackUpdates);
  expect(
    Number(await gameMap.getAttribute('data-camera-three-player-updates')),
  ).toBeGreaterThan(initialThreeUpdates);
  expect(
    Number(await gameMap.getAttribute('data-three-driving-effects-updates')),
  ).toBe(initialEffectsUpdates);
});

test('mantiene HUD compacto y cámara de escritorio al conducir', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  await page.addInitScript(() => window.localStorage.clear());
  await enterExpedition(page);
  await expect
    .poll(
      async () => {
        await page.keyboard.down('w');
        await page.keyboard.down('Shift');
        const speed = Number(
          await page.getByTestId('player-speed').textContent(),
        );
        const compact = await page
          .locator('.player-hud')
          .evaluate((element) =>
            element.classList.contains('player-hud--compact-driving'),
          );
        const camera = await page
          .getByTestId('game-map')
          .getAttribute('data-current-camera-profile');
        return (
          speed > 8 && compact && (camera === 'urban' || camera === 'fast')
        );
      },
      { timeout: 12_000 },
    )
    .toBe(true);
  await expect(page.getByTestId('mobile-driving-hud')).toBeHidden();
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
});

import { expect, type BrowserContext, type Page, test } from '@playwright/test';

interface ViewportCase {
  name: string;
  width: number;
  height: number;
}

const viewports: ViewportCase[] = [
  { name: 'portrait', width: 412, height: 850 },
  { name: 'landscape', width: 850, height: 412 },
  { name: 'tablet', width: 768, height: 1_024 },
  { name: 'small', width: 360, height: 640 },
];

async function enterExpedition(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  await page.getByRole('button', { name: 'Omitir' }).click();
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

async function selectFastMobileTarget(context: BrowserContext, page: Page) {
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
      touchPoints: [{ id: 1, x: centerX, y: centerY, force: 1 }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          id: 1,
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
        async () =>
          Number.parseFloat(
            (await page.getByTestId('mobile-driving-speed').textContent()) ??
              '0',
          ),
        { timeout: 20_000 },
      )
      .toBeGreaterThanOrEqual(58);
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
      'data-camera-update-ms',
      /^\d+\.\d{3}$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-average-update-ms',
      /^\d+\.\d{3}$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-rendered-symbol-count',
      /^\d+$/,
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

    await testInfo.attach(`v0.2.5-${viewport.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
}

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

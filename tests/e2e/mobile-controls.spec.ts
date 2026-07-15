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
  const skipTutorial = page.getByRole('button', { name: 'Omitir' });
  if (await skipTutorial.isVisible()) await skipTutorial.click();
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

test('mantiene velocidad objetivo, gira, frena y activa reversa', async ({
  context,
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-mobile'));
  await startFreshExpedition(page);

  const gameMap = page.getByTestId('game-map');
  await expect(page.getByLabel('Controles táctiles')).toHaveAttribute(
    'data-control-mode',
    'target-speed-joystick',
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

  const joystick = page.getByLabel('Joystick de velocidad objetivo');
  const joystickCenter = await centerOf(joystick);
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 1, x: joystickCenter.x, y: joystickCenter.y, force: 1 },
    ],
  });
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
  await page.waitForTimeout(850);
  await expect
    .poll(async () =>
      Number(await gameMap.getAttribute('data-input-target-speed')),
    )
    .toBeGreaterThan(25);
  const positionWhenReleased = await page
    .getByTestId('player-position')
    .textContent();
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
    .poll(() => page.getByTestId('player-position').textContent())
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
  await expect(gameMap).not.toHaveAttribute('data-input-mobile-boost', 'active');
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
  await expect(gameMap).toHaveAttribute('data-input-cruise-reversing', 'true', {
    timeout: 6_000,
  });
  await expect
    .poll(async () =>
      Number(await gameMap.getAttribute('data-input-throttle')),
    )
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

test('persiste modos alternativos y limpia entradas al pausar', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-mobile'));
  await startFreshExpedition(page);
  const gameMap = page.getByTestId('game-map');

  let { pauseMenu, settings } = await openPauseSettings(page);
  await settings.getByText('Joystick + pedales', { exact: true }).click();
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
    version: 8,
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

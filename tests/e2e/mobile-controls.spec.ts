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

test('conduce con dos pulgares, Turbo por toque y freno de emergencia', async ({
  context,
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-mobile'));
  await startFreshExpedition(page);

  const gameMap = page.getByTestId('game-map');
  await expect(page.getByLabel('Controles táctiles')).toHaveAttribute(
    'data-control-mode',
    'joystick-auto-throttle',
  );
  await expect(page.getByRole('button', { name: 'Acelerar' })).toHaveCount(0);
  await expect(gameMap).toHaveAttribute('data-input-auto-throttle', 'off');

  await page.getByRole('button', { name: 'Activar crucero' }).click();
  await expect(
    page.getByText('El vehículo mantendrá la marcha.'),
  ).toBeVisible();
  await expect(page.getByText('Toca FRENO para detenerlo.')).toBeVisible();
  await expect(gameMap).toHaveAttribute('data-input-auto-throttle', 'active');

  const joystick = page.getByLabel('Joystick de dirección');
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
        x: joystickCenter.x + joystickCenter.width * 0.28,
        y: joystickCenter.y,
        force: 1,
      },
    ],
  });
  await expect
    .poll(async () => Number(await gameMap.getAttribute('data-input-turn')))
    .toBeGreaterThan(0.1);

  await page.getByRole('button', { name: 'Turbo' }).click();
  await expect(gameMap).toHaveAttribute('data-input-mobile-boost', 'active');
  await expect(gameMap).toHaveAttribute('data-input-boost', 'true');
  await expect(page.getByRole('button', { name: 'Turbo' })).toContainText(
    /[012]\.\d s/,
  );
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await session.detach();
  await expect(gameMap).toHaveAttribute('data-input-turn', '0.000');
  await expect(gameMap).toHaveAttribute('data-input-auto-throttle', 'active');

  const brake = page.getByRole('button', { name: 'Frenar o retroceder' });
  const brakeCenter = await centerOf(brake);
  await page.mouse.move(brakeCenter.x, brakeCenter.y);
  await page.mouse.down();
  await expect(gameMap).toHaveAttribute('data-input-throttle', '-1.000');
  await expect(gameMap).toHaveAttribute('data-input-mobile-boost', 'off');
  await expect(gameMap).toHaveAttribute('data-input-auto-throttle', 'off');
  await page.mouse.up();

  await page.getByRole('button', { name: 'Activar crucero' }).click();
  await page.getByRole('button', { name: 'Turbo' }).click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event('orientationchange')),
  );
  await expect(gameMap).toHaveAttribute('data-input-mobile-boost', 'off');
  await expect(gameMap).toHaveAttribute('data-input-auto-throttle', 'off');
  await expect(gameMap).toHaveAttribute('data-input-pointer-active', 'false');
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
    version: 6,
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

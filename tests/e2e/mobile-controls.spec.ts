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
  await page.getByRole('button', { name: 'Pausar partida' }).last().click();
  const pauseMenu = page.getByRole('dialog', { name: 'Partida en pausa' });
  await expect(pauseMenu).toBeVisible();
  await pauseMenu.getByRole('button', { name: 'Configuración' }).click();
  const settings = page.getByRole('dialog', { name: 'Configuración' });
  await expect(settings).toBeVisible();
  return { pauseMenu, settings };
}

test('combina joystick, acelerador y turbo sin mover el mapa', async ({
  context,
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-mobile'));
  await startFreshExpedition(page);

  const gameMap = page.getByTestId('game-map');
  const joystick = page.getByLabel('Joystick de dirección');
  const accelerator = page.getByRole('button', { name: 'Acelerar' });
  const turbo = page.getByRole('button', { name: 'Turbo' });
  const joystickCenter = await centerOf(joystick);
  const acceleratorCenter = await centerOf(accelerator);
  const initialPosition = await page
    .getByTestId('player-position')
    .textContent();

  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 1, x: joystickCenter.x, y: joystickCenter.y, force: 1 },
      { id: 2, x: acceleratorCenter.x, y: acceleratorCenter.y, force: 1 },
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
      { id: 2, x: acceleratorCenter.x, y: acceleratorCenter.y, force: 1 },
    ],
  });

  await expect
    .poll(async () => Number(await gameMap.getAttribute('data-input-turn')))
    .toBeGreaterThan(0.1);
  expect(Number(await gameMap.getAttribute('data-input-turn'))).toBeLessThan(1);
  await expect(gameMap).toHaveAttribute('data-input-throttle', '1.000');
  await expect(gameMap).toHaveAttribute('data-input-pointer-active', 'true');
  await expect(
    page.getByRole('button', { name: 'Desactivar seguimiento' }).first(),
  ).toBeVisible();
  await page.waitForTimeout(450);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await session.detach();

  await expect(gameMap).toHaveAttribute('data-input-turn', '0.000');
  await expect(gameMap).toHaveAttribute('data-input-throttle', '0.000');
  await expect(gameMap).toHaveAttribute('data-input-pointer-active', 'false');
  await expect
    .poll(() => page.getByTestId('player-position').textContent())
    .not.toBe(initialPosition);

  const acceleratorAgain = await centerOf(accelerator);
  const turboCenter = await centerOf(turbo);
  const turboSession = await context.newCDPSession(page);
  await turboSession.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 3, x: acceleratorAgain.x, y: acceleratorAgain.y, force: 1 },
      { id: 4, x: turboCenter.x, y: turboCenter.y, force: 1 },
    ],
  });
  await expect(gameMap).toHaveAttribute('data-input-throttle', '1.000');
  await expect(gameMap).toHaveAttribute('data-input-boost', 'true');
  await turboSession.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await turboSession.detach();
  await expect(gameMap).toHaveAttribute('data-input-throttle', '0.000');
  await expect(gameMap).toHaveAttribute('data-input-boost', 'false');
  await expect(gameMap).toHaveAttribute('data-input-pointer-active', 'false');
});

test('cancela crucero e input interrumpido y persiste la cruceta', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-mobile'));
  await startFreshExpedition(page);
  const gameMap = page.getByTestId('game-map');

  let { pauseMenu, settings } = await openPauseSettings(page);
  await settings.getByText('Joystick y AUTO', { exact: true }).click();
  await settings.getByText('Grande', { exact: true }).click();
  await settings
    .getByRole('slider', { name: 'Zona muerta del joystick' })
    .fill('0.2');
  await settings.getByText('Directa', { exact: true }).click();
  await settings.getByRole('checkbox', { name: /Crucero al entrar/ }).check();
  await settings.getByRole('button', { name: 'Listo' }).click();
  await pauseMenu.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByLabel('Controles táctiles')).toHaveAttribute(
    'data-control-mode',
    'joystick-auto-throttle',
  );
  const activateCruise = page.getByRole('button', { name: 'Activar crucero' });
  if (await activateCruise.isVisible()) await activateCruise.click();
  await expect(
    page.getByRole('button', { name: 'Desactivar crucero' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(gameMap).toHaveAttribute('data-input-auto-throttle', 'active');

  const brake = page.getByRole('button', { name: 'Frenar o retroceder' });
  const brakeCenter = await centerOf(brake);
  await page.mouse.move(brakeCenter.x, brakeCenter.y);
  await page.mouse.down();
  await expect(gameMap).toHaveAttribute('data-input-throttle', '-1.000');
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: 'Activar crucero' }),
  ).toBeVisible();
  await expect(gameMap).toHaveAttribute('data-input-auto-throttle', 'off');

  await page.getByRole('button', { name: 'Activar crucero' }).click();
  await page.getByRole('button', { name: 'Pausar partida' }).last().click();
  pauseMenu = page.getByRole('dialog', { name: 'Partida en pausa' });
  await expect(pauseMenu).toBeVisible();
  await expect(gameMap).toHaveAttribute('data-input-throttle', '0.000');
  await expect(gameMap).toHaveAttribute('data-input-auto-throttle', 'off');
  await pauseMenu.getByRole('button', { name: 'Continuar' }).click();

  const joystick = page.getByLabel('Joystick de dirección');
  const joystickCenter = await centerOf(joystick);
  await page.mouse.move(joystickCenter.x, joystickCenter.y);
  await page.mouse.down();
  await page.mouse.move(
    joystickCenter.x + joystickCenter.width * 0.25,
    joystickCenter.y,
  );
  await expect
    .poll(async () => Number(await gameMap.getAttribute('data-input-turn')))
    .toBeGreaterThan(0.05);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(gameMap).toHaveAttribute('data-input-turn', '0.000');
  await expect(gameMap).toHaveAttribute('data-input-pointer-active', 'false');
  await page.mouse.up();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  ({ pauseMenu, settings } = await openPauseSettings(page));
  await settings.getByText('Cruceta clásica', { exact: true }).click();
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
    version: 5,
    settings: {
      controlMode: 'classic-buttons',
      joystickSize: 'large',
      joystickDeadZone: 0.2,
      steeringSensitivity: 'high',
      autoThrottleDefault: true,
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
  await expect(page.getByLabel('Controles táctiles')).toHaveAttribute(
    'data-control-mode',
    'classic-buttons',
  );
});

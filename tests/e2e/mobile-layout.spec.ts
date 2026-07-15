import { expect, type Page, test } from '@playwright/test';

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectanglesOverlap(first: Rectangle, second: Rectangle): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

async function enterExpedition(page: Page) {
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  await page.getByRole('button', { name: 'Omitir' }).click();

  const labels = page.locator('.mobile-action-labels');
  await expect(labels).toBeVisible();
  const labelsBox = await labels.boundingBox();
  const initialHudBox = await page.locator('.player-hud').boundingBox();
  expect(labelsBox).not.toBeNull();
  expect(initialHudBox).not.toBeNull();
  expect(rectanglesOverlap(labelsBox!, initialHudBox!)).toBe(false);

  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
}

test('mantiene controles y paneles utilizables en viewport táctil', async ({
  context,
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-mobile'));
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await enterExpedition(page);

  const touchControls = page.getByLabel('Controles táctiles');
  await expect(touchControls).toBeVisible();
  await expect(page.getByLabel('Joystick de velocidad objetivo')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Frenar o retroceder' }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Turbo' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Centrar cámara en el jugador' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Pausar partida' }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ver detalles' }),
  ).toBeVisible();
  await expect(page.getByText('Rutas Perdidas', { exact: true })).toBeVisible();
  await expect(
    page.getByText('El Salvador: Rutas Perdidas', { exact: true }),
  ).toBeHidden();

  await page.getByRole('button', { name: 'Partida y guardado' }).click();
  await expect(
    page.getByRole('menuitem', { name: 'Inventario' }),
  ).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Controles' })).toBeVisible();
  await page.getByRole('button', { name: 'Partida y guardado' }).click();

  const hudBox = await page.locator('.player-hud').boundingBox();
  const missionBox = await page.locator('.mission-panel').boundingBox();
  const joystickBox = await page
    .getByLabel('Joystick de velocidad objetivo')
    .boundingBox();
  const actionsBox = await page.locator('.touch-actions').boundingBox();
  const attribution = page.locator('.maplibregl-ctrl-attrib');
  const attributionInner = attribution.locator('.maplibregl-ctrl-attrib-inner');
  await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
  await expect(attributionInner).toBeHidden();
  const attributionBox = await attribution
    .locator('.maplibregl-ctrl-attrib-button')
    .boundingBox();
  expect(hudBox).not.toBeNull();
  expect(missionBox).not.toBeNull();
  expect(joystickBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(attributionBox).not.toBeNull();
  expect(rectanglesOverlap(hudBox!, missionBox!)).toBe(false);
  expect(rectanglesOverlap(hudBox!, joystickBox!)).toBe(false);
  expect(rectanglesOverlap(missionBox!, actionsBox!)).toBe(false);
  expect(rectanglesOverlap(joystickBox!, actionsBox!)).toBe(false);
  for (const box of [hudBox!, missionBox!, joystickBox!, actionsBox!]) {
    expect(rectanglesOverlap(attributionBox!, box)).toBe(false);
  }

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const box of [
    hudBox!,
    missionBox!,
    joystickBox!,
    actionsBox!,
    attributionBox!,
  ]) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height);
  }

  const initialPosition = await page
    .getByTestId('player-position')
    .textContent();
  const joystickCenter = await page
    .getByLabel('Joystick de velocidad objetivo')
    .boundingBox();
  expect(joystickCenter).not.toBeNull();
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      {
        id: 1,
        x: joystickCenter!.x + joystickCenter!.width / 2,
        y: joystickCenter!.y + joystickCenter!.height / 2,
        force: 1,
      },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 1,
        x: joystickCenter!.x + joystickCenter!.width / 2,
        y: joystickCenter!.y + joystickCenter!.height * 0.12,
        force: 1,
      },
    ],
  });
  await page.waitForTimeout(650);
  await expect
    .poll(() => page.getByTestId('player-position').textContent())
    .not.toBe(initialPosition);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await session.detach();

  const hasDocumentScroll = await page.evaluate(
    () =>
      document.documentElement.scrollHeight >
        document.documentElement.clientHeight ||
      document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
  );
  expect(hasDocumentScroll).toBe(false);
});

test('colapsa la misión, usa bottom sheet y pausa la guía en reversa', async ({
  context,
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-mobile'));
  test.setTimeout(60_000);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await enterExpedition(page);
  await expect(page.locator('.discovery-toast')).toBeVisible();

  await page.getByRole('button', { name: 'Iniciar misión' }).click();
  await page
    .getByRole('dialog', { name: 'Una señal de auxilio' })
    .getByRole('button', { name: 'Comenzar investigación' })
    .click();
  const missionPanel = page.getByRole('complementary', {
    name: 'Panel de misiones',
  });
  await expect(missionPanel).toHaveAttribute('data-mobile-sheet-state', 'half');
  await expect(page.getByText('Continuar misión', { exact: true })).toHaveCount(
    0,
  );

  await page.keyboard.down('e');
  await page.waitForTimeout(60);
  await page.keyboard.up('e');
  const radio = page.locator('.radio-message');
  await expect(radio).toBeVisible();
  await expect(page.locator('.overlay-manager')).toHaveAttribute(
    'data-active-overlay',
    'radio',
  );
  const radioBox = await radio.boundingBox();
  const radioJoystickBox = await page
    .getByLabel('Joystick de velocidad objetivo')
    .boundingBox();
  const radioActionsBox = await page
    .locator('.touch-actions--analog')
    .boundingBox();
  const viewport = page.viewportSize();
  expect(radioBox).not.toBeNull();
  expect(radioJoystickBox).not.toBeNull();
  expect(radioActionsBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(radioBox!.height).toBeLessThanOrEqual(viewport!.height * 0.26);
  expect(rectanglesOverlap(radioBox!, radioJoystickBox!)).toBe(false);
  expect(rectanglesOverlap(radioBox!, radioActionsBox!)).toBe(false);
  await page.getByRole('button', { name: 'Cerrar transmisión' }).click();
  await expect(page.locator('.mission-route-arrow')).toBeVisible({
    timeout: 20_000,
  });

  const joystick = page.getByLabel('Joystick de velocidad objetivo');
  const joystickBox = await joystick.boundingBox();
  expect(joystickBox).not.toBeNull();
  const centerX = joystickBox!.x + joystickBox!.width / 2;
  const centerY = joystickBox!.y + joystickBox!.height / 2;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 10, x: centerX, y: centerY, force: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 10,
        x: centerX,
        y: centerY - joystickBox!.width * 0.44,
        force: 1,
      },
    ],
  });
  await expect
    .poll(async () => Number(await page.getByTestId('player-speed').textContent()))
    .toBeGreaterThan(5);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(joystick).toHaveAttribute('data-processing-ms', /^\d+\.\d{3}$/);

  const miniNavigator = page.getByTestId('mobile-mini-navigator');
  await expect(miniNavigator).toBeVisible({ timeout: 6_000 });
  await expect(missionPanel).toHaveAttribute(
    'data-mobile-sheet-state',
    'compact',
  );
  await expect(missionPanel).toHaveAttribute('data-render-count', /^\d+$/);
  await expect(missionPanel).toHaveAttribute(
    'data-sheet-render-count',
    /^\d+$/,
  );
  await expect(miniNavigator).toContainText('La transmisión');
  await expect(miniNavigator).toContainText('Ver objetivo');

  const playerBox = await page.locator('.player-marker').boundingBox();
  const arrowBox = await page.locator('.mission-route-arrow').boundingBox();
  expect(playerBox).not.toBeNull();
  expect(arrowBox).not.toBeNull();
  const markerSeparation = Math.hypot(
    playerBox!.x + playerBox!.width / 2 - (arrowBox!.x + arrowBox!.width / 2),
    playerBox!.y + playerBox!.height / 2 - (arrowBox!.y + arrowBox!.height / 2),
  );
  expect(markerSeparation).toBeGreaterThan(12);

  await miniNavigator
    .getByRole('button', { name: 'Ver objetivo de La transmisión' })
    .click();
  await expect(missionPanel).toHaveAttribute('data-mobile-sheet-state', 'half');
  const halfSheetBox = await missionPanel.boundingBox();
  expect(halfSheetBox).not.toBeNull();
  expect(halfSheetBox!.height).toBeLessThanOrEqual(viewport!.height * 0.56);
  await page.getByRole('button', { name: 'Expandir bitácora' }).click();
  await expect(missionPanel).toHaveAttribute(
    'data-mobile-sheet-state',
    'expanded',
  );
  await page.getByRole('button', { name: 'Cerrar bitácora' }).click();
  await expect(miniNavigator).toBeVisible();

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 11, x: centerX, y: centerY, force: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 11,
        x: centerX,
        y: centerY + joystickBox!.width * 0.44,
        force: 1,
      },
    ],
  });
  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute('data-input-cruise-reversing', 'true', {
    timeout: 8_000,
  });
  await expect(gameMap).toHaveAttribute('data-navigation-reversing', 'true');
  await expect(miniNavigator).toHaveAttribute('data-reversing', 'true');
  await expect(miniNavigator).toContainText('Reversa · guía pausada');
  await expect(page.locator('.mission-route-arrow')).toBeHidden();
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await session.detach();
});

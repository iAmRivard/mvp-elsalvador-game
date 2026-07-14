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
  await expect(page.getByLabel('Joystick de conducción')).toBeVisible();
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
  const joystickBox = await page.locator('.virtual-joystick').boundingBox();
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
    .getByLabel('Joystick de conducción')
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

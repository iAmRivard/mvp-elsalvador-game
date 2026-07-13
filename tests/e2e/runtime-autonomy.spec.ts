import { expect, type Page, test } from '@playwright/test';

async function enterExpedition(page: Page) {
  const launchButton = page.getByRole('button', {
    name: /^(Comenzar|Continuar) expedición$/,
  });
  await expect(launchButton).toBeVisible();
  await launchButton.click();

  const skipTutorial = page.getByRole('button', { name: 'Omitir' });
  if (await skipTutorial.isVisible()) await skipTutorial.click();

  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
}

test('carga el mapa sin solicitudes a terceros', async ({ page, baseURL }) => {
  const applicationOrigin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin;
  const externalRequests: string[] = [];
  const criticalErrors: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== applicationOrigin) {
      externalRequests.push(request.url());
    }
  });
  page.on('pageerror', (error) => criticalErrors.push(error.message));

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'El Salvador: Rutas Perdidas' }),
  ).toBeVisible();
  await enterExpedition(page);
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  const mapFrame = page.locator('.map-frame');
  await expect(mapFrame).toHaveAttribute(
    'data-player-renderer',
    /^(ready|fallback|disabled)$/,
    { timeout: 20_000 },
  );
  const playerRenderer = await mapFrame.getAttribute('data-player-renderer');
  const playerMarker = page.locator('.player-marker');
  await expect(playerMarker).toBeAttached();
  if (playerRenderer !== 'ready') await expect(playerMarker).toBeVisible();
  await expect(page.locator('.location-marker')).toHaveCount(12);
  await expect(page.getByText('Nueva ubicación descubierta')).toBeVisible();
  await expect(
    page.getByText('San Salvador', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Misiones' })).toBeVisible();

  const expandMissions = page.getByRole('button', {
    name: 'Expandir panel de misiones',
  });
  if (await expandMissions.isVisible()) await expandMissions.click();

  const firstMission = page
    .getByRole('article')
    .filter({ hasText: 'Camino hacia Santa Ana' });
  await firstMission.getByRole('button', { name: 'Iniciar' }).click();
  await expect(
    page.getByRole('heading', { name: 'Camino hacia Santa Ana' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Abandonar misión' }),
  ).toBeVisible();
  await expect(page.locator('.location-marker--mission')).toHaveCount(1);

  const position = page.getByTestId('player-position');
  const initialPosition = await position.textContent();
  await page.keyboard.down('w');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  await expect(position).not.toHaveText(initialPosition ?? '');

  await page.getByRole('button', { name: 'Partida y guardado' }).click();
  await page.getByRole('menuitem', { name: 'Guardar ahora' }).click();
  await expect(page.getByText('Partida guardada')).toBeVisible();
  await page.reload();
  await enterExpedition(page);
  await expect(
    page.getByRole('heading', { name: 'Camino hacia Santa Ana' }),
  ).toBeVisible();

  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45, {
      steps: 5,
    });
    await page.mouse.up();
  }

  expect(externalRequests).toEqual([]);
  expect(criticalErrors).toEqual([]);
});

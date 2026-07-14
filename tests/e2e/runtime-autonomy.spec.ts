import { expect, type Page, test } from '@playwright/test';

interface RasterStats {
  luminanceVariance: number;
  luminanceRange: number;
  opaqueRatio: number;
}

async function rasterStats(
  page: Page,
  screenshot: Buffer,
): Promise<RasterStats> {
  const imageUrl = `data:image/png;base64,${screenshot.toString('base64')}`;
  return page.evaluate(async (url) => {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 100;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No se pudo inspeccionar el canvas.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    let squaredSum = 0;
    let minimum = 255;
    let maximum = 0;
    let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance =
        pixels[index] * 0.2126 +
        pixels[index + 1] * 0.7152 +
        pixels[index + 2] * 0.0722;
      sum += luminance;
      squaredSum += luminance * luminance;
      minimum = Math.min(minimum, luminance);
      maximum = Math.max(maximum, luminance);
      if (pixels[index + 3] >= 250) opaque += 1;
    }
    const count = pixels.length / 4;
    const mean = sum / count;
    return {
      luminanceVariance: squaredSum / count - mean * mean,
      luminanceRange: maximum - minimum,
      opaqueRatio: opaque / count,
    };
  }, imageUrl);
}

async function rasterDifference(
  page: Page,
  before: Buffer,
  after: Buffer,
): Promise<number> {
  const urls = [before, after].map(
    (screenshot) => `data:image/png;base64,${screenshot.toString('base64')}`,
  );
  return page.evaluate(async ([beforeUrl, afterUrl]) => {
    const load = async (url: string) =>
      createImageBitmap(await (await fetch(url)).blob());
    const [beforeBitmap, afterBitmap] = await Promise.all([
      load(beforeUrl),
      load(afterUrl),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 100;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No se pudo comparar el canvas.');
    context.drawImage(beforeBitmap, 0, 0, canvas.width, canvas.height);
    const beforePixels = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    ).data;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(afterBitmap, 0, 0, canvas.width, canvas.height);
    const afterPixels = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    ).data;
    beforeBitmap.close();
    afterBitmap.close();
    let changed = 0;
    for (let index = 0; index < beforePixels.length; index += 4) {
      const difference =
        Math.abs(beforePixels[index] - afterPixels[index]) +
        Math.abs(beforePixels[index + 1] - afterPixels[index + 1]) +
        Math.abs(beforePixels[index + 2] - afterPixels[index + 2]);
      if (difference >= 24) changed += 1;
    }
    return changed / (beforePixels.length / 4);
  }, urls);
}

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

async function interact(page: Page) {
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  await page.keyboard.up('Space');
}

test('carga el mapa sin solicitudes a terceros', async ({
  page,
  baseURL,
}, testInfo) => {
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
  const initialCanvasScreenshot = await page
    .locator('.maplibregl-canvas')
    .screenshot();
  await testInfo.attach('mapa-inicial', {
    body: initialCanvasScreenshot,
    contentType: 'image/png',
  });
  const initialRaster = await rasterStats(page, initialCanvasScreenshot);
  expect(initialRaster.luminanceVariance).toBeGreaterThan(100);
  expect(initialRaster.luminanceRange).toBeGreaterThan(40);
  expect(initialRaster.opaqueRatio).toBeGreaterThan(0.98);
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
  await expect(page.locator('.location-marker')).toHaveCount(14);
  await expect(page.locator('.player-hud')).toContainText('1 / 14');
  await expect(
    page.getByText('San Salvador', { exact: true }).first(),
  ).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Misiones' })).toBeVisible();
  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready', {
    timeout: 20_000,
  });
  await expect(gameMap).toHaveAttribute('data-road-load-ms', /^\d+(\.\d+)?$/);
  await expect(gameMap).toHaveAttribute('data-road-search-ms', /^\d+(\.\d+)?$/);
  expect(
    Number(await gameMap.getAttribute('data-road-file-bytes')),
  ).toBeGreaterThan(5_000_000);
  await expect(gameMap).toHaveAttribute('data-runtime-fps', /^\d+(\.\d+)?$/, {
    timeout: 5_000,
  });
  await expect(page.getByTestId('driving-surface')).toContainText(
    /Vía secundaria|Calle residencial|Vía terciaria/,
  );
  await expect(gameMap).toHaveAttribute('data-follow-offset-y', /^[1-9]\d*$/);
  const stoppedZoom = Number(await gameMap.getAttribute('data-follow-zoom'));
  expect(stoppedZoom).toBeGreaterThan(15.5);

  const expandMissions = page.getByRole('button', {
    name: 'Expandir panel de misiones',
  });
  if (await expandMissions.isVisible()) await expandMissions.click();

  const firstMission = page.locator('.mission-list__item').filter({
    has: page.getByRole('heading', {
      name: 'La transmisión',
      exact: true,
    }),
  });
  await firstMission.getByRole('button', { name: 'Iniciar' }).click();
  await page.getByRole('button', { name: 'Sintonizar' }).click();
  await expect(
    page.getByRole('heading', { name: 'La transmisión' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Abandonar misión' }),
  ).toBeVisible();
  await expect(page.locator('.location-marker--mission')).toHaveCount(1);
  await interact(page);
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road', {
    timeout: 20_000,
  });
  const routeCoordinateCount = Number(
    await gameMap.getAttribute('data-mission-route-coordinate-count'),
  );
  expect(routeCoordinateCount).toBeGreaterThan(10);
  await expect(page.locator('.mission-route-summary')).toHaveAttribute(
    'data-route-status',
    'road',
  );
  await expect(gameMap).toHaveAttribute(
    'data-route-calculation-ms',
    /^\d+(\.\d+)?$/,
  );
  await expect(page.locator('.mission-navigation-next')).toBeVisible();
  await expect(page.locator('.mission-route-arrow')).toBeVisible();
  await expect(gameMap).toHaveAttribute(
    'data-navigation-next-type',
    /^(continue|turn-left|turn-right|slight-left|slight-right|u-turn|arrive)$/,
  );
  const positionBeforeRecalculation = await page
    .getByTestId('player-position')
    .textContent();
  await page.getByRole('button', { name: 'Recalcular ruta' }).click();
  await page.keyboard.down('w');
  await expect(gameMap).toHaveAttribute('data-input-throttle', '1.000');
  await page.waitForTimeout(350);
  await page.keyboard.up('w');
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road');
  await expect
    .poll(() => page.getByTestId('player-position').textContent())
    .not.toBe(positionBeforeRecalculation);

  await page.getByRole('button', { name: 'Abandonar misión' }).click();
  const suchitotoMission = page.locator('.mission-list__item').filter({
    has: page.getByRole('heading', {
      name: 'Señales en Suchitoto',
      exact: true,
    }),
  });
  await suchitotoMission.getByRole('button', { name: 'Iniciar' }).click();
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'fallback');
  await expect(gameMap).toHaveAttribute(
    'data-mission-route-coordinate-count',
    '2',
  );
  await page.getByRole('button', { name: 'Abandonar misión' }).click();
  await firstMission.getByRole('button', { name: 'Iniciar' }).click();
  await page.getByRole('button', { name: 'Sintonizar' }).click();
  await interact(page);
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road');

  const position = page.getByTestId('player-position');
  const initialPosition = await position.textContent();
  const canvasBeforeMovement = await page
    .locator('.maplibregl-canvas')
    .screenshot();
  await page.keyboard.down('w');
  await page.waitForTimeout(700);
  const movingZoom = Number(await gameMap.getAttribute('data-follow-zoom'));
  const canvasAfterMovement = await page
    .locator('.maplibregl-canvas')
    .screenshot();
  await page.keyboard.up('w');
  await expect(position).not.toHaveText(initialPosition ?? '');
  await testInfo.attach('mapa-despues-de-conducir', {
    body: canvasAfterMovement,
    contentType: 'image/png',
  });
  expect(
    await rasterDifference(page, canvasBeforeMovement, canvasAfterMovement),
  ).toBeGreaterThan(0.005);
  expect(movingZoom).toBeLessThan(stoppedZoom);

  await page.getByRole('button', { name: 'Partida y guardado' }).click();
  await page.getByRole('menuitem', { name: 'Guardar ahora' }).click();
  await expect(page.getByText('Partida guardada')).toBeVisible();
  await page.reload();
  await enterExpedition(page);
  await expect(
    page.getByRole('heading', { name: 'La transmisión' }),
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
  await expect(
    page.getByRole('button', { name: 'Seguir al jugador' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Seguir al jugador' }).click();
  await expect(
    page.getByRole('button', { name: 'Desactivar seguimiento' }),
  ).toBeVisible();

  expect(externalRequests).toEqual([]);
  expect(criticalErrors).toEqual([]);
});

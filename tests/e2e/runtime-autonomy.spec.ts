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
  const imageBase64 = screenshot.toString('base64');
  return page.evaluate(async (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const bitmap = await createImageBitmap(
      new Blob([bytes.buffer], { type: 'image/png' }),
    );
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
  }, imageBase64);
}

async function rasterDifference(
  page: Page,
  before: Buffer,
  after: Buffer,
): Promise<number> {
  const imagesBase64 = [before, after].map((screenshot) =>
    screenshot.toString('base64'),
  );
  return page.evaluate(async ([beforeBase64, afterBase64]) => {
    const load = async (base64: string) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return createImageBitmap(new Blob([bytes.buffer], { type: 'image/png' }));
    };
    const [beforeBitmap, afterBitmap] = await Promise.all([
      load(beforeBase64),
      load(afterBase64),
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
  }, imagesBase64);
}

async function enterExpedition(page: Page) {
  const launchButton = page.getByRole('button', {
    name: /^(Comenzar|Continuar) expedición$/,
  });
  await expect(launchButton).toBeVisible();
  await launchButton.click();

  const skipTutorial = page.getByRole('button', { name: 'Omitir' });
  if (await skipTutorial.isVisible()) await skipTutorial.click();
  const beginMission = page.getByRole('button', {
    name: /Comenzar investigación/,
  });
  if (await beginMission.isVisible()) await beginMission.click();

  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-road-network-status',
    'ready',
    { timeout: 25_000 },
  );
}

async function interact(page: Page) {
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  await page.keyboard.up('Space');
}

async function expandMissionJournal(page: Page) {
  const details = page.getByRole('button', { name: 'Ver detalles' });
  const expandMissions = page.getByRole('button', {
    name: 'Expandir panel de misiones',
  });
  const viewObjective = page.getByRole('button', { name: /Ver objetivo/ });
  const drivingHud = page.getByRole('button', {
    name: 'Abrir bitácora de la misión',
  });
  const missionsTab = page.getByRole('button', {
    name: 'Misiones',
    exact: true,
  });
  await expect
    .poll(async () => {
      if ((await missionsTab.count()) > 0) {
        try {
          await missionsTab
            .first()
            .evaluate((element) => (element as HTMLButtonElement).click());
          return true;
        } catch {
          // El panel puede cambiar de presentación entre frames.
        }
      }
      for (const candidate of [
        details,
        drivingHud,
        viewObjective,
        expandMissions,
      ]) {
        if ((await candidate.count()) === 0) continue;
        try {
          await candidate
            .first()
            .evaluate((element) => (element as HTMLButtonElement).click());
          return false;
        } catch {
          // La presentación móvil puede desmontar un candidato entre frames.
        }
      }
      return false;
    })
    .toBe(true);
}

async function abandonActiveMission(page: Page) {
  const abandonMission = page.getByRole('button', { name: 'Abandonar misión' });
  if (!(await abandonMission.isVisible())) await expandMissionJournal(page);
  await abandonMission.scrollIntoViewIfNeeded();
  await abandonMission.evaluate((element) =>
    (element as HTMLButtonElement).click(),
  );
  await expect(
    page.getByRole('complementary', { name: 'Panel de misiones' }),
  ).not.toContainText('Abandonar misión');
}

async function startMissionFromList(
  page: Page,
  title: string,
  buttonName: string | RegExp = 'Iniciar',
) {
  await expandMissionJournal(page);
  const missionCard = page
    .locator('.mission-list__item, .mission-optional')
    .filter({
      has: page.getByRole('heading', { name: title, exact: true }),
    });
  await expect(missionCard).toBeVisible();
  await missionCard
    .getByRole('button', { name: buttonName })
    .evaluate((element) => (element as HTMLButtonElement).click());
}

test('carga el mapa sin solicitudes a terceros', async ({
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(90_000);
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
  if (testInfo.project.name === 'chromium-desktop') {
    await expect(page.locator('.player-hud')).toContainText('1 / 14');
  } else {
    await expect(page.locator('.player-hud')).toBeHidden();
    await expect(page.getByTestId('mobile-driving-hud')).toBeVisible();
  }
  await expect(
    page.getByText('San Salvador', { exact: true }).first(),
  ).toBeAttached();
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
  await expect(gameMap).toHaveAttribute(
    'data-driving-surface-label',
    /Vía secundaria|Calle residencial|Vía terciaria|Zona del objetivo/,
  );
  await expect(gameMap).toHaveAttribute('data-follow-offset-y', /^[1-9]\d*$/);
  const stoppedZoom = Number(await gameMap.getAttribute('data-follow-zoom'));
  expect(stoppedZoom).toBeGreaterThan(15.5);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.querySelector<HTMLElement>('#root');
        return [root?.scrollLeft ?? -1, root?.scrollTop ?? -1];
      }),
    )
    .toEqual([0, 0]);
  await expect(page.locator('.location-marker--mission')).toHaveCount(1);
  await interact(page);
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road', {
    timeout: 20_000,
  });
  await expect(gameMap).toHaveAttribute(
    'data-mission-route-casing-color',
    '#06242C',
  );
  await expect(gameMap).toHaveAttribute(
    'data-mission-route-road-color',
    '#28D7F5',
  );
  await expect(gameMap).toHaveAttribute(
    'data-mission-route-immediate-color',
    '#D8FBFF',
  );
  await expect(gameMap).toHaveAttribute(
    'data-mission-route-fallback-color',
    '#FF9F43',
  );
  await expect(gameMap).toHaveAttribute(
    'data-mission-route-target-color',
    '#FFE169',
  );
  const routeCoordinateCount = Number(
    await gameMap.getAttribute('data-mission-route-coordinate-count'),
  );
  expect(routeCoordinateCount).toBeGreaterThan(10);
  await expect(gameMap).toHaveAttribute(
    'data-route-calculation-ms',
    /^\d+(\.\d+)?$/,
  );
  await expect(page.locator('.mission-route-arrow')).toBeVisible();
  await expect(gameMap).toHaveAttribute(
    'data-navigation-next-type',
    /^(continue|turn-left|turn-right|slight-left|slight-right|u-turn|arrive)$/,
  );
  const positionBeforeRecalculation = await gameMap.evaluate(
    (element) =>
      `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
  );
  await page.keyboard.press('r');
  await page.keyboard.down('w');
  await expect(gameMap).toHaveAttribute('data-input-throttle', '1.000');
  await page.waitForTimeout(350);
  await page.keyboard.up('w');
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road');
  await expect
    .poll(() =>
      gameMap.evaluate(
        (element) =>
          `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
      ),
    )
    .not.toBe(positionBeforeRecalculation);

  await abandonActiveMission(page);
  await expandMissionJournal(page);
  const suchitotoMission = page.locator('.mission-optional').filter({
    has: page.getByRole('heading', {
      name: 'Señales en Suchitoto',
      exact: true,
    }),
  });
  await expect(suchitotoMission).toBeVisible();
  await suchitotoMission
    .getByRole('button', { name: 'Iniciar opcional' })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'fallback');
  await expect(gameMap).toHaveAttribute(
    'data-mission-route-coordinate-count',
    '2',
  );
  await abandonActiveMission(page);
  await startMissionFromList(page, 'La transmisión');
  await page.getByRole('button', { name: 'Comenzar investigación' }).click();
  await interact(page);
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road');

  const initialPosition = await gameMap.evaluate(
    (element) =>
      `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
  );
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
  await expect
    .poll(() =>
      gameMap.evaluate(
        (element) =>
          `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
      ),
    )
    .not.toBe(initialPosition);
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
  await expect(gameMap).toHaveAttribute(
    'data-navigation-target-kind',
    'mission-objective',
    { timeout: 20_000 },
  );
  await expect(page.locator('.location-marker--mission')).toHaveCount(1);

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
  const followButton = page.getByRole('button', { name: 'Seguir vehículo' });
  if (await followButton.isVisible()) {
    await expect(followButton).toHaveAttribute('aria-pressed', 'false');
    await followButton.click();
    await expect(followButton).toHaveAttribute('aria-pressed', 'true');
  } else {
    await page
      .getByRole('button', { name: 'Centrar cámara en el jugador' })
      .click();
  }

  expect(externalRequests).toEqual([]);
  expect(criticalErrors).toEqual([]);
});

import { expect, test } from '@playwright/test';

async function launch(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  const beginMission = page.getByRole('button', {
    name: /Comenzar investigación/,
  });
  if (await beginMission.isVisible()) await beginMission.click();
  const skip = page.getByRole('button', { name: 'Omitir' });
  if (await skip.isVisible()) await skip.click();
}

async function dragMapToFreshTiles(
  page: import('@playwright/test').Page,
): Promise<void> {
  const canvasBounds = await page.locator('.maplibregl-canvas').boundingBox();
  if (!canvasBounds) throw new Error('No se pudo localizar el canvas del mapa.');
  await page.mouse.move(
    canvasBounds.x + canvasBounds.width / 2,
    canvasBounds.y + canvasBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvasBounds.x + canvasBounds.width * 0.8,
    canvasBounds.y + canvasBounds.height * 0.8,
    { steps: 8 },
  );
  await page.mouse.up();
}

test('reintenta un fallo fatal sin recargar ni perder el estado de sesión', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  let styleRequests = 0;
  const spriteRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/map-assets/sprites/')) {
      spriteRequests.push(request.url());
    }
  });
  await page.route('**/map-assets/styles/el-salvador.json', async (route) => {
    styleRequests += 1;
    if (styleRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: '{}',
      });
      return;
    }
    await route.continue();
  });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await launch(page);

  await expect(page.locator('.map-message--error > strong')).toBeVisible();
  await expect(
    page.getByText('Vuelve a intentarlo. Tu progreso no se perdió.'),
  ).toBeVisible();
  await expect(page.getByText(/AJAXError|503/)).toBeHidden();
  await page.evaluate(() => {
    (window as Window & { retryMarker?: string }).retryMarker = 'preservado';
  });
  await page.getByRole('button', { name: 'Reintentar' }).click();

  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-road-network-status',
    'ready',
    { timeout: 20_000 },
  );
  expect(
    await page.evaluate(
      () => (window as Window & { retryMarker?: string }).retryMarker,
    ),
  ).toBe('preservado');
  expect(styleRequests).toBeGreaterThanOrEqual(2);
  expect(spriteRequests).toEqual([]);
});

test('un fallo tardío del PMTiles principal corta el input activo', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  let failArchiveRequests = false;
  let failedArchiveRequests = 0;
  await page.route('**/maps/el-salvador.pmtiles*', async (route) => {
    if (!failArchiveRequests) {
      await route.continue();
      return;
    }
    failedArchiveRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/octet-stream',
      headers: { 'cache-control': 'no-store' },
      body: '',
    });
  });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await launch(page);

  const gameMap = page.getByTestId('game-map');
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
  await page.keyboard.down('w');
  await expect
    .poll(async () => Number(await gameMap.getAttribute('data-input-throttle')))
    .toBeGreaterThan(0);

  failArchiveRequests = true;
  await dragMapToFreshTiles(page);
  await expect.poll(() => failedArchiveRequests).toBeGreaterThan(0);

  await expect(gameMap).toHaveAttribute(
    'data-map-last-error-severity',
    'fatal',
  );
  await expect(page.locator('.map-message--error > strong')).toBeVisible();
  expect(failedArchiveRequests).toBeGreaterThan(0);
  await expect(gameMap).toHaveAttribute('data-input-throttle', '0.000');
  await expect(gameMap).toHaveAttribute('data-input-mobile-boost', 'off');
  await page.keyboard.up('w');
});

test('la carga vial tardía no sobrescribe un error fatal', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  let markRoadRequestStarted: () => void = () => undefined;
  const roadRequestStarted = new Promise<void>((resolve) => {
    markRoadRequestStarted = resolve;
  });
  let releaseRoadRequest: () => void = () => undefined;
  const roadRequestRelease = new Promise<void>((resolve) => {
    releaseRoadRequest = resolve;
  });
  await page.route('**/data/roads/western-corridor.json', async (route) => {
    markRoadRequestStarted();
    await roadRequestRelease;
    await route.continue();
  });

  let failArchiveRequests = false;
  let failedArchiveRequests = 0;
  await page.route('**/maps/el-salvador.pmtiles*', async (route) => {
    if (!failArchiveRequests) {
      await route.continue();
      return;
    }
    failedArchiveRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/octet-stream',
      headers: { 'cache-control': 'no-store' },
      body: '',
    });
  });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await launch(page);
  await roadRequestStarted;

  const gameMap = page.getByTestId('game-map');
  failArchiveRequests = true;
  await dragMapToFreshTiles(page);
  await expect.poll(() => failedArchiveRequests).toBeGreaterThan(0);
  await expect(gameMap).toHaveAttribute(
    'data-map-last-error-severity',
    'fatal',
  );
  await expect(page.locator('.map-message--error > strong')).toBeVisible();

  releaseRoadRequest();
  await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready', {
    timeout: 20_000,
  });
  await expect(page.locator('.map-message--error > strong')).toBeVisible();
  await expect(page.getByText('El mapa local está listo.')).not.toBeAttached();
});

for (const deviceScaleFactor of [2, 3]) {
  test(`inicia con DPR ${deviceScaleFactor} sin solicitar sprites`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop');
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const spriteRequests: string[] = [];
    const failedResponses: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/map-assets/sprites/')) {
        spriteRequests.push(request.url());
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto(baseURL ?? 'http://127.0.0.1:4173');
    await launch(page);
    await expect(page.getByText('El mapa local está listo.')).toBeAttached({
      timeout: 20_000,
    });
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    expect(spriteRequests).toEqual([]);
    expect(failedResponses).toEqual([]);
    await context.close();
  });
}

test('reinicia y vuelve a alinear con la red vial ya montada', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await launch(page);
  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready', {
    timeout: 20_000,
  });
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
  const position = page.getByTestId('player-position');
  const alignedStart = await position.textContent();

  await expect
    .poll(
      async () => {
        await page.keyboard.down('w');
        return position.textContent();
      },
      { timeout: 8_000 },
    )
    .not.toBe(alignedStart ?? '');
  await page.keyboard.up('w');

  await page.getByRole('button', { name: 'Partida y guardado' }).click();
  await page.getByRole('menuitem', { name: 'Reiniciar partida' }).click();
  const confirmation = page.getByRole('alertdialog', {
    name: '¿Reiniciar la expedición?',
  });
  await confirmation.getByRole('button', { name: 'Reiniciar partida' }).click();

  await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready');
  await expect.poll(() => position.textContent()).toBe(alignedStart);
  await expect(gameMap).toHaveAttribute('data-input-mobile-boost', 'off');
  await expect(gameMap).toHaveAttribute('data-input-throttle', '0.000');
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const serviceWorkerSource = readFileSync(resolve('public/sw.js'), 'utf8');
const precacheManifest = JSON.parse(
  readFileSync(resolve('dist/precache-manifest.json'), 'utf8'),
) as { buildIdentity: string; assets: string[] };
const builtServiceWorkerSource = serviceWorkerSource.replaceAll(
  '__BUILD_SHA__',
  precacheManifest.buildIdentity.replace(/[^a-z0-9._-]/gi, '-'),
);

test('precachea el shell y prepara la red vial offline desde la primera instalaciÃ³n', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  const browserFailures: string[] = [];
  page.on('requestfailed', (request) => {
    browserFailures.push(
      `request:${new URL(request.url()).pathname}:${request.failure()?.errorText ?? 'failed'}`,
    );
  });
  page.on('pageerror', (error) => {
    browserFailures.push(`page:${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserFailures.push(`console:${message.text()}`);
    }
  });
  await page.goto('/');
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);

  const cachedRelease = await page.evaluate(async () => {
    const manifest = (await fetch('/precache-manifest.json').then((response) =>
      response.json(),
    )) as { buildIdentity: string; assets: string[] };
    const staticCacheName = (await caches.keys()).find((key) =>
      key.includes('static-v0.3.0'),
    );
    if (!staticCacheName) return null;
    const cache = await caches.open(staticCacheName);
    const paths = (await cache.keys()).map(
      (request) => new URL(request.url).pathname,
    );
    return {
      buildIdentity: manifest.buildIdentity,
      staticCacheName,
      missingBuildAssets: manifest.assets.filter(
        (asset) => !paths.includes(asset),
      ),
      hasPrecacheManifest: paths.includes('/precache-manifest.json'),
      hasRoadNetwork: paths.includes('/data/roads/western-corridor.json'),
      hasPlayerModel: paths.includes('/models/expedition-vehicle.glb'),
      hasSignalModel: paths.includes('/models/suchitoto-signal.glb'),
      hasMapArchive: paths.some((path) => path.endsWith('.pmtiles')),
    };
  });
  expect(cachedRelease).toEqual({
    buildIdentity: precacheManifest.buildIdentity,
    staticCacheName: expect.stringContaining(precacheManifest.buildIdentity),
    missingBuildAssets: [],
    hasPrecacheManifest: true,
    hasRoadNetwork: true,
    hasPlayerModel: true,
    hasSignalModel: true,
    hasMapArchive: false,
  });

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/El Salvador: Rutas Perdidas/);
    const offlineCacheState = await page.evaluate(async () => {
      const resources = [
        ...document.querySelectorAll<HTMLScriptElement>('script[src]'),
        ...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      ].map((element) =>
        element instanceof HTMLScriptElement ? element.src : element.href,
      );
      return {
        controlled: Boolean(navigator.serviceWorker.controller),
        controllerUrl: navigator.serviceWorker.controller?.scriptURL ?? null,
        cacheNames: await caches.keys(),
        resources: await Promise.all(
          resources.map(async (resource) => ({
            resource,
            cached: Boolean(await caches.match(resource)),
          })),
        ),
      };
    });
    await expect
      .poll(async () => {
        if ((await page.locator('#root > *').count()) > 0) return 'ready';
        return `${browserFailures.slice(-12).join('\n') || 'root-empty'}\n${JSON.stringify(offlineCacheState)}`;
      })
      .toBe('ready');
    await expect(page.locator('[data-preparation-stage="ready"]')).toBeVisible({
      timeout: 25_000,
    });

    const launchButton = page.locator('.start-button--primary');
    await expect(launchButton).toHaveCount(1);
    await expect(launchButton).toBeEnabled();
  } finally {
    await context.setOffline(false);
  }
});

async function installUpdateCandidate(
  page: Page,
  candidate: string,
): Promise<void> {
  await page.evaluate(async (candidateName) => {
    const registration = await navigator.serviceWorker.register(
      `/sw.js?candidate=${candidateName}`,
    );
    const worker = registration.installing ?? registration.waiting;
    if (!worker) throw new Error('No se creó el service worker candidato.');
    if (worker.state !== 'installed') {
      await new Promise<void>((resolveInstalled, rejectInstalled) => {
        const timeout = window.setTimeout(
          () => rejectInstalled(new Error('El candidato no llegó a waiting.')),
          10_000,
        );
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') {
            window.clearTimeout(timeout);
            resolveInstalled();
          } else if (worker.state === 'redundant') {
            window.clearTimeout(timeout);
            rejectInstalled(new Error('El candidato quedó redundant.'));
          }
        });
      });
    }
    if (!registration.waiting) {
      throw new Error('El service worker candidato no quedó esperando.');
    }
  }, candidate);
}

test('valida el ciclo PWA real y difiere actualizaciones durante una misión', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route('**/sw.js?candidate=*', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: 'application/javascript; charset=utf-8',
      body: `${builtServiceWorkerSource}\n// ${url.searchParams.get('candidate') ?? ''}\n`,
    });
  });

  await page.goto('/');
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean(await navigator.serviceWorker.getRegistration()),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);

  await page.evaluate(async () => {
    const cacheName = (await caches.keys()).find((key) =>
      key.includes('shell-v0.3.0'),
    );
    if (!cacheName) throw new Error('No se encontró el shell cache.');
    const cache = await caches.open(cacheName);
    await cache.put(
      new Request('/network-first-probe'),
      new Response('<title>STALE-PWA-SHELL</title>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );
  });
  await page.goto('/network-first-probe');
  await expect(page).toHaveTitle(/El Salvador: Rutas Perdidas/);
  await expect(page.locator('body')).not.toContainText('STALE-PWA-SHELL');

  await installUpdateCandidate(page, 'skip-waiting');
  await expect(
    page.getByText('Nueva versión lista para instalar.'),
  ).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.setItem('pwa-controller-changes', '0');
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        const changes = Number(
          sessionStorage.getItem('pwa-controller-changes') ?? 0,
        );
        sessionStorage.setItem('pwa-controller-changes', String(changes + 1));
      },
      { once: true },
    );
  });
  await Promise.all([
    page.waitForEvent('domcontentloaded'),
    page.getByRole('button', { name: 'Actualizar ahora' }).click(),
  ]);
  await expect
    .poll(() =>
      page.evaluate(() => sessionStorage.getItem('pwa-controller-changes')),
    )
    .toBe('1');
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ''),
    )
    .toContain('candidate=skip-waiting');

  const hashedAsset = await page
    .locator('script[src*="/assets/"]')
    .first()
    .getAttribute('src');
  expect(hashedAsset).toBeTruthy();
  const cacheFirstResult = await page.evaluate(async (assetUrl) => {
    if (!assetUrl) throw new Error('No se encontró un asset con hash.');
    const cacheName = (await caches.keys()).find((key) =>
      key.includes('static-v0.3.0'),
    );
    if (!cacheName) throw new Error('No se encontró el static cache.');
    const cache = await caches.open(cacheName);
    await cache.put(
      new Request(assetUrl),
      new Response('CACHE_FIRST_SENTINEL', {
        headers: { 'content-type': 'application/javascript' },
      }),
    );
    return fetch(assetUrl).then((response) => response.text());
  }, hashedAsset);
  expect(cacheFirstResult).toBe('CACHE_FIRST_SENTINEL');

  const modelContentType = await page.evaluate(async () => {
    const modelUrl = '/models/expedition-vehicle.glb';
    const first = await fetch(modelUrl);
    if (!first.ok) throw new Error('No se pudo cargar el modelo local.');
    await first.arrayBuffer();
    return first.headers.get('content-type') ?? '';
  });
  expect(modelContentType).toContain('model/gltf-binary');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const cacheName = (await caches.keys()).find((key) =>
          key.includes('static-v0.3.0'),
        );
        if (!cacheName) return false;
        const cache = await caches.open(cacheName);
        return Boolean(await cache.match('/models/expedition-vehicle.glb'));
      }),
    )
    .toBe(true);

  const rangeResult = await page.evaluate(async () => {
    const request = new Request('/maps/el-salvador.pmtiles', {
      headers: { Range: 'bytes=0-1023' },
    });
    const response = await fetch(request);
    const bytes = (await response.arrayBuffer()).byteLength;
    return {
      status: response.status,
      bytes,
      cached: Boolean(await caches.match(request)),
    };
  });
  expect(rangeResult).toEqual({ status: 206, bytes: 1_024, cached: false });

  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  await expect(
    page.getByRole('button', { name: 'Comenzar investigación' }),
  ).toBeVisible();
  await installUpdateCandidate(page, 'deferred-active-mission');
  await expect(
    page.getByText(
      'Nueva versión lista. Podrás actualizar al terminar la misión.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Actualizar ahora' }),
  ).toBeDisabled();
});

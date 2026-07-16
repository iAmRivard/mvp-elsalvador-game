import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const serviceWorkerSource = readFileSync(resolve('public/sw.js'), 'utf8');

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
      body: `${serviceWorkerSource}\n// ${url.searchParams.get('candidate') ?? ''}\n`,
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
      key.includes('shell-v0.2.5.2'),
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
  await expect(page.getByText('Nueva versión lista para instalar.')).toBeVisible();
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
      page.evaluate(
        () => navigator.serviceWorker.controller?.scriptURL ?? '',
      ),
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
      key.includes('static-v0.2.5.2'),
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
  await expect(page.getByRole('button', { name: 'Actualizar ahora' })).toBeDisabled();
});

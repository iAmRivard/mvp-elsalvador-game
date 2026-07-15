import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173';
const outputDirectory = resolve(process.argv[3] ?? 'test-results/driving-ux');
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  await page.getByRole('button', { name: 'Omitir' }).click();
  await page.waitForFunction(() => {
    const map = document.querySelector('[data-testid="game-map"]');
    return (
      map instanceof HTMLElement &&
      ['ready', 'unavailable'].includes(map.dataset.roadNetworkStatus ?? '')
    );
  });
  const closeRadio = page.getByRole('button', { name: 'Cerrar transmisión' });
  if (await closeRadio.isVisible()) await closeRadio.click();

  const joystick = page.getByLabel('Joystick de velocidad objetivo');
  const joystickBox = await joystick.boundingBox();
  if (!joystickBox) throw new Error('No se encontró el joystick móvil.');
  const centerX = joystickBox.x + joystickBox.width / 2;
  const centerY = joystickBox.y + joystickBox.height / 2;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, x: centerX, y: centerY, force: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 1,
        x: centerX,
        y: centerY - joystickBox.width * 0.44,
        force: 1,
      },
    ],
  });
  await page.waitForFunction(() => {
    const value = document.querySelector(
      '[data-testid="mobile-driving-speed"]',
    );
    return Number.parseFloat(value?.textContent ?? '0') >= 58;
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.getByTestId('game-map').waitFor({ state: 'visible' });
  await page.screenshot({
    path: resolve(outputDirectory, 'v0.2.5-mobile-after.png'),
  });

  const metrics = await page.evaluate(() => {
    const box = (selector) => {
      const rectangle = document
        .querySelector(selector)
        ?.getBoundingClientRect();
      return rectangle
        ? {
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
          }
        : null;
    };
    const map = document.querySelector('[data-testid="game-map"]');
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      hud: box('[data-testid="mobile-driving-hud"]'),
      joystick: box('[aria-label="Joystick de velocidad objetivo"]'),
      actions: box('.touch-actions'),
      mapDataset: map instanceof HTMLElement ? { ...map.dataset } : {},
    };
  });
  await writeFile(
    resolve(outputDirectory, 'v0.2.5-mobile-metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
    'utf8',
  );
  await session.detach();
  await context.close();
} finally {
  await browser.close();
}

console.log(`Driving UX capture written to ${outputDirectory}`);

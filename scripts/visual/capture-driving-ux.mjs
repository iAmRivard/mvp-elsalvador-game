import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173';
const outputDirectory = resolve(
  process.argv[3] ?? 'test-results/driving-ux-v0.2.5.1',
);
const observationMilliseconds = 30_000;
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.__v0251LongTasks = [];
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__v0251LongTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
            });
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch {
        // Long Tasks API no está disponible en todos los navegadores.
      }
    }
  });
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  await page.getByRole('button', { name: 'Omitir' }).click();
  const beginMission = page.getByRole('button', {
    name: /Comenzar investigación/,
  });
  if (await beginMission.isVisible()) await beginMission.click();
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
    path: resolve(outputDirectory, 'v0.2.5.1-mobile-after.png'),
  });

  const initial = await page.evaluate(() => {
    const count = (selector, key = 'renderCount') => {
      const element = document.querySelector(selector);
      return element instanceof HTMLElement
        ? Number(element.dataset[key] ?? 0)
        : 0;
    };
    const map = document.querySelector('[data-testid="game-map"]');
    window.__v0251LongTasks = [];
    window.__v0251DeclutterChanges = 0;
    if (map instanceof HTMLElement) {
      const observer = new MutationObserver(() => {
        window.__v0251DeclutterChanges += 1;
      });
      observer.observe(map, {
        attributes: true,
        attributeFilter: ['data-map-declutter-profile'],
      });
      window.__v0251DeclutterObserver = observer;
    }
    return {
      mobileDrivingHud: count('.mobile-driving-hud'),
      playerHud: count('.player-hud'),
      missionPanel: count('.mission-panel'),
      missionPanelHeavy: count('.mission-panel', 'sheetRenderCount'),
      radio: count('.radio-message'),
    };
  });

  await page.waitForTimeout(observationMilliseconds);

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
    const count = (selector, key = 'renderCount') => {
      const element = document.querySelector(selector);
      return element instanceof HTMLElement
        ? Number(element.dataset[key] ?? 0)
        : 0;
    };
    const longTasks = window.__v0251LongTasks ?? [];
    window.__v0251DeclutterObserver?.disconnect();
    return {
      observationMilliseconds: 30_000,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      hud: box('[data-testid="mobile-driving-hud"]'),
      joystick: box('[aria-label="Joystick de velocidad objetivo"]'),
      actions: box('.touch-actions'),
      mapDataset: map instanceof HTMLElement ? { ...map.dataset } : {},
      counters: {
        mobileDrivingHud: count('.mobile-driving-hud'),
        playerHud: count('.player-hud'),
        missionPanel: count('.mission-panel'),
        missionPanelHeavy: count('.mission-panel', 'sheetRenderCount'),
        radio: count('.radio-message'),
      },
      declutterChanges: window.__v0251DeclutterChanges ?? 0,
      longTasks: {
        count: longTasks.length,
        totalMilliseconds: longTasks.reduce(
          (total, task) => total + task.duration,
          0,
        ),
        maximumMilliseconds: longTasks.reduce(
          (maximum, task) => Math.max(maximum, task.duration),
          0,
        ),
      },
    };
  });
  metrics.renderDeltas = Object.fromEntries(
    Object.entries(metrics.counters).map(([key, value]) => [
      key,
      value - initial[key],
    ]),
  );
  await writeFile(
    resolve(outputDirectory, 'v0.2.5.1-mobile-metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
    'utf8',
  );
  const captureViewports = [
    { name: 'reference-392', width: 392, height: 850 },
    { name: 'portrait-412', width: 412, height: 850 },
    { name: 'landscape', width: 850, height: 412 },
    { name: 'tablet', width: 768, height: 1_024 },
    { name: 'small', width: 360, height: 640 },
  ];
  for (const viewport of captureViewports) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.waitForTimeout(250);
    await page.screenshot({
      path: resolve(outputDirectory, `v0.2.5.1-mobile-${viewport.name}.png`),
    });
  }
  await session.detach();
  await context.close();
} finally {
  await browser.close();
}

console.log(`Driving UX capture written to ${outputDirectory}`);

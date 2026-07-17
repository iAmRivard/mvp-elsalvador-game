import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173';
const outputDirectory = resolve(
  process.argv[3] ?? 'artifacts/arcade-five-minutes',
);
const durationMilliseconds = Number(process.argv[4] ?? 300_000);
const repositorySha = (() => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
})();
const captureTimes = [0, 1, 3, 8, 15, 30, 45, 75, 120, 180, 300]
  .map((seconds) => seconds * 1_000)
  .filter((milliseconds) => milliseconds <= durationMilliseconds);

await mkdir(outputDirectory, { recursive: true });

function filename(milliseconds) {
  return `${String(Math.round(milliseconds / 1_000)).padStart(3, '0')}s.png`;
}

async function touch(session, id, start, end, duration = 180) {
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id, ...start, force: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id, ...end, force: 1 }],
  });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, duration));
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    viewport: { width: 392, height: 850 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(baseUrl);
  const buildSha = await page
    .locator('[data-build-sha]')
    .getAttribute('data-build-sha');
  await page.getByRole('button', { name: /Comenzar expedici.n/ }).click();
  await page.getByRole('button', { name: /Comenzar investigaci.n/ }).click();
  const skip = page.getByRole('button', { name: 'Omitir' });
  if (await skip.isVisible()) await skip.click();
  const map = page.getByTestId('game-map');
  await map.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="game-map"]');
    return (
      element instanceof HTMLElement &&
      ['ready', 'unavailable'].includes(element.dataset.roadNetworkStatus ?? '')
    );
  });

  const joystick = page.getByLabel(/Joystick de conducci.n arcade/);
  const box = await joystick.boundingBox();
  if (!box) throw new Error('No se encontro el joystick arcade.');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const session = await context.newCDPSession(page);
  const startedAt = Date.now();
  let touchId = 1;
  let nextCapture = 0;
  let firstEventMilliseconds = null;
  let firstRewardMilliseconds = null;
  let recoveries = 0;
  let stationaryMilliseconds = 0;
  let previousTick = startedAt;

  await page.screenshot({
    path: resolve(outputDirectory, filename(0)),
    fullPage: true,
  });
  nextCapture = 1;
  await touch(
    session,
    touchId++,
    center,
    { x: center.x, y: center.y - box.width * 0.46 },
    240,
  );

  while (Date.now() - startedAt < durationMilliseconds) {
    const elapsed = Date.now() - startedAt;
    const now = Date.now();
    const speed = Number(
      (await map.getAttribute('data-player-speed-kilometers-per-hour')) ?? 0,
    );
    if (speed < 1) stationaryMilliseconds += now - previousTick;
    previousTick = now;

    while (
      nextCapture < captureTimes.length &&
      elapsed >= captureTimes[nextCapture]
    ) {
      await page.screenshot({
        path: resolve(outputDirectory, filename(captureTimes[nextCapture])),
        fullPage: true,
      });
      nextCapture += 1;
    }

    const reward = page.locator('[data-gameplay-reward]');
    if (firstRewardMilliseconds === null && (await reward.isVisible())) {
      firstRewardMilliseconds = elapsed;
    }
    const radio = page.locator('.radio-message:not(.radio-message--compact)');
    if (firstEventMilliseconds === null && (await radio.isVisible())) {
      firstEventMilliseconds = elapsed;
    }
    const interaction = page.getByRole('button', { name: /Escuchar se.al/ });
    if (await interaction.isVisible()) {
      await interaction.click();
    } else {
      const rejoin = page.getByRole('button', { name: 'REINCORPORAR' });
      if (await rejoin.isVisible()) {
        await rejoin.click();
        recoveries += 1;
      } else if (elapsed % 1_000 < 300) {
        const recommended = Number(
          await map.getAttribute('data-navigation-recommended-heading'),
        );
        const heading = Number(
          await map.getAttribute('data-navigation-physical-heading'),
        );
        const delta = ((recommended - heading + 540) % 360) - 180;
        if (Number.isFinite(delta) && Math.abs(delta) > 5) {
          await touch(session, touchId++, center, {
            x: center.x + Math.sign(delta) * box.width * 0.42,
            y: center.y,
          });
        }
      }
    }

    await page.waitForTimeout(200);
  }

  await page.screenshot({
    path: resolve(outputDirectory, filename(durationMilliseconds)),
    fullPage: true,
  });
  const layout = await page.evaluate(() => {
    const mapElement = document.querySelector('[data-testid="game-map"]');
    const usefulMapAreaRatio =
      mapElement instanceof HTMLElement
        ? Number(mapElement.dataset.usefulMapAreaRatio)
        : Number.NaN;
    const hasUsefulMapAreaRatio = Number.isFinite(usefulMapAreaRatio);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      usefulMapAreaRatio: hasUsefulMapAreaRatio ? usefulMapAreaRatio : null,
      hudAreaRatio: hasUsefulMapAreaRatio
        ? Math.max(0, 1 - usefulMapAreaRatio)
        : null,
      overlays: document.querySelectorAll(
        '[role="dialog"], .radio-message:not(.radio-message--compact)',
      ).length,
      selectedVehicleId:
        mapElement instanceof HTMLElement
          ? (mapElement.dataset.selectedVehicleId ?? null)
          : null,
      roadNetworkStatus:
        mapElement instanceof HTMLElement
          ? (mapElement.dataset.roadNetworkStatus ?? null)
          : null,
    };
  });
  await writeFile(
    resolve(outputDirectory, 'session.json'),
    `${JSON.stringify(
      {
        captureMetadata: {
          repositorySha,
          buildSha,
          baseUrl,
          capturedAt: new Date().toISOString(),
        },
        durationMilliseconds,
        captureTimesMilliseconds: captureTimes,
        firstEventMilliseconds,
        firstRewardMilliseconds,
        stationaryMilliseconds,
        recoveries,
        layout,
        physicalPlaytestRequired: true,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await session.detach();
} finally {
  await browser.close();
}

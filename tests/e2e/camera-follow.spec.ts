import { expect, test, type Locator } from '@playwright/test';

interface FollowSample {
  playerX: number;
  playerY: number;
  offsetX: number;
  offsetY: number;
  lookahead: number;
  steeringCueDegrees: number;
  accelerationCueDegrees: number;
}

async function readFollowSample(gameMap: Locator): Promise<FollowSample> {
  return gameMap.evaluate((element) => ({
    playerX: Number(element.dataset.playerProjectedX),
    playerY: Number(element.dataset.playerProjectedY),
    offsetX: Number(element.dataset.followZoneOffsetX),
    offsetY: Number(element.dataset.followZoneOffsetY),
    lookahead: Number(element.dataset.cameraRouteLookaheadPixels),
    steeringCueDegrees: Number(element.dataset.threeVehicleSteeringCueDegrees),
    accelerationCueDegrees: Number(
      element.dataset.threeVehicleAccelerationCueDegrees,
    ),
  }));
}

test.describe(
  'seguimiento móvil de cámara',
  { tag: ['@camera', '@mobile'] },
  () => {
    test(
      'permite movimiento proyectado acotado durante aceleración y giro',
      { tag: ['@performance', '@release'] },
      async ({ context, page }) => {
        await page.addInitScript(() => {
          window.localStorage.clear();
          window.sessionStorage.clear();
          // This focused scenario validates the medium-quality Three.js cues.
          // GitHub's constrained runner reports four logical cores and would
          // otherwise select the intentional low-quality marker fallback.
          Object.defineProperty(window.navigator, 'hardwareConcurrency', {
            configurable: true,
            value: 8,
          });
          Object.defineProperty(window.navigator, 'deviceMemory', {
            configurable: true,
            value: 8,
          });
        });
        await page.goto('/');
        await page.getByRole('button', { name: /Comenzar expedición/ }).click();
        await page
          .getByRole('button', { name: /Comenzar investigación/ })
          .click();
        const skip = page.getByRole('button', { name: 'Omitir' });
        if (await skip.isVisible()) await skip.click();

        const gameMap = page.getByTestId('game-map');
        await expect(gameMap).toHaveAttribute(
          'data-road-network-status',
          'ready',
          {
            timeout: 20_000,
          },
        );
        await expect(
          page.getByRole('img', { name: 'Vehículo del jugador' }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(gameMap.locator('..')).toHaveAttribute(
          'data-player-renderer',
          'ready',
          { timeout: 20_000 },
        );

        const joystick = page.getByLabel('Joystick de conducción arcade');
        const box = await joystick.boundingBox();
        expect(box).not.toBeNull();
        const center = {
          x: box!.x + box!.width / 2,
          y: box!.y + box!.height / 2,
        };
        const session = await context.newCDPSession(page);
        const samples: FollowSample[] = [];
        try {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ id: 1, ...center, force: 1 }],
          });
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
              {
                id: 1,
                x: center.x,
                y: center.y - box!.width * 0.36,
                force: 1,
              },
            ],
          });
          await expect
            .poll(
              () =>
                gameMap.evaluate((element) =>
                  Number(element.dataset.playerSpeedKilometersPerHour),
                ),
              { timeout: 4_000, intervals: [16, 33, 50] },
            )
            .toBeGreaterThan(2);
          await expect
            .poll(
              () =>
                gameMap.evaluate((element) =>
                  Number(element.dataset.cameraCadenceHertz),
                ),
              { timeout: 2_000, intervals: [16, 33, 50] },
            )
            .toBeGreaterThanOrEqual(30);

          for (let index = 0; index < 36; index += 1) {
            samples.push(await readFollowSample(gameMap));
            await page.waitForTimeout(33);
          }

          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
              {
                id: 1,
                x: center.x + box!.width * 0.32,
                y: center.y - box!.width * 0.36,
                force: 1,
              },
            ],
          });
          for (let index = 0; index < 24; index += 1) {
            samples.push(await readFollowSample(gameMap));
            await page.waitForTimeout(33);
          }
        } finally {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
          });
          await session.detach();
        }

        const finiteSamples = samples.filter((sample) =>
          Object.values(sample).every(Number.isFinite),
        );
        const projectedPositions = new Set(
          finiteSamples.map(
            ({ playerX, playerY }) =>
              `${playerX.toFixed(1)},${playerY.toFixed(1)}`,
          ),
        );
        expect(finiteSamples.length).toBeGreaterThan(40);
        expect(projectedPositions.size).toBeGreaterThan(3);
        expect(
          Math.max(...finiteSamples.map(({ offsetX }) => Math.abs(offsetX))),
        ).toBeLessThanOrEqual(24.1);
        expect(
          Math.max(...finiteSamples.map(({ offsetY }) => Math.abs(offsetY))),
        ).toBeLessThanOrEqual(19.1);
        expect(
          Math.max(...finiteSamples.map(({ lookahead }) => lookahead)),
        ).toBeGreaterThan(0);
        expect(
          Math.max(...finiteSamples.map(({ lookahead }) => lookahead)),
        ).toBeLessThanOrEqual(14.1);
        expect(
          Math.max(
            ...finiteSamples.map(({ steeringCueDegrees }) =>
              Math.abs(steeringCueDegrees),
            ),
          ),
        ).toBeGreaterThan(0.01);
        expect(
          Math.max(
            ...finiteSamples.map(({ accelerationCueDegrees }) =>
              Math.abs(accelerationCueDegrees),
            ),
          ),
        ).toBeGreaterThan(0.01);
        await expect(gameMap).toHaveAttribute(
          'data-player-outside-safe-viewport',
          'false',
        );
      },
    );
  },
);

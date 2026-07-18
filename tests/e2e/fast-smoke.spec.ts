import { expect, test } from '@playwright/test';

test.describe(
  'smoke móvil esencial',
  { tag: ['@smoke', '@mobile', '@release'] },
  () => {
    test(
      'recorre ocho escenarios esenciales con interacción real',
      { tag: ['@camera', '@map', '@navigation'] },
      async ({ context, page }) => {
        await page.addInitScript(() => {
          window.localStorage.clear();
          window.sessionStorage.clear();
        });
        await page.goto('/');

        await test.step('muestra el inicio en español', async () => {
          await expect(
            page.getByRole('button', { name: 'Comenzar expedición' }),
          ).toBeVisible();
        });

        await test.step('abre la investigación inicial', async () => {
          await page
            .getByRole('button', { name: 'Comenzar expedición' })
            .click();
          await expect(
            page.getByRole('button', { name: /Comenzar investigación/ }),
          ).toBeVisible();
        });

        await test.step('entra al juego con interacción real', async () => {
          await page
            .getByRole('button', { name: /Comenzar investigación/ })
            .click();
          const skip = page.getByRole('button', { name: 'Omitir' });
          if (await skip.isVisible()) await skip.click();
          await expect(page.getByTestId('game-map')).toBeVisible();
        });

        const gameMap = page.getByTestId('game-map');
        await test.step('carga el mapa local sin error fatal', async () => {
          await expect(gameMap).toHaveAttribute(
            'data-road-network-status',
            'ready',
            { timeout: 20_000 },
          );
          await expect(page.locator('.map-message--error')).toHaveCount(0);
        });

        await test.step('mantiene visible el vehículo', async () => {
          await expect(
            page.getByRole('img', { name: 'Vehículo del jugador' }),
          ).toBeVisible({ timeout: 20_000 });
        });

        await test.step('mantiene disponible la ruta activa', async () => {
          await expect(gameMap).toHaveAttribute(
            'data-mission-route-mode',
            /road|fallback/,
            { timeout: 20_000 },
          );
        });

        await test.step('inicia con seguimiento y viewport seguro', async () => {
          await expect(gameMap).toHaveAttribute(
            'data-following-player',
            'true',
          );
          await expect(gameMap).toHaveAttribute(
            'data-player-outside-safe-viewport',
            'false',
          );
        });

        await test.step('produce el primer movimiento táctil real', async () => {
          const initialPosition = await gameMap.evaluate(
            (element) =>
              `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
          );
          const joystick = page.getByLabel('Joystick de conducción arcade');
          const box = await joystick.boundingBox();
          expect(box).not.toBeNull();
          const session = await context.newCDPSession(page);
          const center = {
            x: box!.x + box!.width / 2,
            y: box!.y + box!.height / 2,
          };
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
                  y: center.y - box!.width * 0.22,
                  force: 1,
                },
              ],
            });
            await expect
              .poll(
                () =>
                  gameMap.evaluate(
                    (element) =>
                      `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
                  ),
                { timeout: 3_000, intervals: [16, 33, 50] },
              )
              .not.toBe(initialPosition);
          } finally {
            await session.send('Input.dispatchTouchEvent', {
              type: 'touchEnd',
              touchPoints: [],
            });
            await session.detach();
          }
          await expect(gameMap).toHaveAttribute(
            'data-player-outside-safe-viewport',
            'false',
          );
        });
      },
    );
  },
);

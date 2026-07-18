import { expect, test } from '@playwright/test';

test(
  'mantiene detalle arcade mientras la misión está detenida',
  { tag: ['@map', '@mobile', '@navigation', '@release'] },
  async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile');
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Comenzar expedición' }).click();
    await page.getByRole('button', { name: /Comenzar investigación/ }).click();
    const skip = page.getByRole('button', { name: 'Omitir' });
    if (await skip.isVisible()) await skip.click();

    const gameMap = page.getByTestId('game-map');
    await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready', {
      timeout: 20_000,
    });
    await expect(gameMap).toHaveAttribute(
      'data-map-detail-mode',
      'arcade-driving',
    );
    await expect(gameMap).toHaveAttribute('data-map-poi-visibility', 'none');
    await expect(gameMap).toHaveAttribute(
      'data-map-local-place-visibility',
      'none',
    );
    await expect(gameMap).toHaveAttribute(
      'data-map-major-place-visibility',
      'visible',
    );
    await expect(gameMap).toHaveAttribute('data-map-missing-layer-count', '0');
    await expect(gameMap).toHaveAttribute(
      'data-mission-route-visual-ready',
      'true',
      { timeout: 20_000 },
    );
    await expect(gameMap).toHaveAttribute('data-navigation-target-id', /.+/, {
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Explorar mapa' }).click();
    await expect(gameMap).toHaveAttribute('data-following-player', 'false');
    await expect(gameMap).toHaveAttribute(
      'data-map-detail-mode',
      'exploration',
      { timeout: 2_000 },
    );
    await expect(gameMap).toHaveAttribute('data-map-poi-visibility', 'visible');
    await expect(gameMap).toHaveAttribute(
      'data-map-local-place-visibility',
      'visible',
    );

    await page
      .getByRole('button', { name: 'Centrar cámara en el jugador' })
      .click();
    await expect(gameMap).toHaveAttribute('data-following-player', 'true');
    await expect(gameMap).toHaveAttribute(
      'data-map-detail-mode',
      'arcade-driving',
      { timeout: 2_000 },
    );

    const joystick = page.getByLabel('Joystick de conducción arcade');
    const joystickBox = await joystick.boundingBox();
    expect(joystickBox).not.toBeNull();
    const center = {
      x: joystickBox!.x + joystickBox!.width / 2,
      y: joystickBox!.y + joystickBox!.height / 2,
    };
    const session = await context.newCDPSession(page);
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
            y: center.y - joystickBox!.width * 0.5,
            force: 1,
          },
        ],
      });
      await expect(gameMap).toHaveAttribute(
        'data-map-detail-mode',
        'arcade-fast',
        { timeout: 8_000 },
      );
    } finally {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await session.detach();
    }
    await expect(gameMap).toHaveAttribute('data-map-poi-visibility', 'none');
    await expect(gameMap).toHaveAttribute(
      'data-map-local-place-visibility',
      'none',
    );
    await expect(gameMap).toHaveAttribute('data-map-missing-layer-count', '0');
  },
);

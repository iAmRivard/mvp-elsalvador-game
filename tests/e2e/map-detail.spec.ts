import { expect, test } from '@playwright/test';

test(
  'mantiene detalle arcade mientras la misión está detenida',
  { tag: ['@map', '@mobile', '@navigation', '@release'] },
  async ({ page }, testInfo) => {
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
  },
);

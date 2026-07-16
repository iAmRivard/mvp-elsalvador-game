import { expect, test } from '@playwright/test';

test('muestra zona del objetivo en el punto vial observado sin alterar la superficie', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.getByRole('button', { name: 'Comenzar expedici\u00f3n' }).click();
  const beginMission = page.getByRole('button', {
    name: /Comenzar investigación/,
  });
  if (await beginMission.isVisible()) await beginMission.click();
  const skip = page.getByRole('button', { name: 'Omitir' });
  if (await skip.isVisible()) await skip.click();

  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute(
    'data-road-network-status',
    /ready|unavailable/,
    { timeout: 25_000 },
  );
  await expect(gameMap).toHaveAttribute(
    'data-inside-valid-objective-zone',
    'true',
    { timeout: 15_000 },
  );
  await expect(gameMap).toHaveAttribute(
    'data-driving-surface-label',
    'Zona del objetivo',
  );
  await expect(page.getByTestId('driving-surface')).toContainText(
    'Zona del objetivo',
  );

  const physicalSurface = await gameMap.getAttribute('data-road-surface');
  expect(physicalSurface).not.toBe('Zona del objetivo');
});

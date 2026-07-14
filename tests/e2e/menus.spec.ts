import { expect, test } from '@playwright/test';

test('recorre inicio, tutorial, pausa y configuración', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'El Salvador: Rutas Perdidas' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Configuración' }).click();
  const settings = page.getByRole('dialog', { name: 'Configuración' });
  await expect(settings).toBeVisible();
  const highQuality = settings.getByRole('radio', { name: /Alta/ });
  await settings.getByText('Alta', { exact: true }).click();
  await expect(highQuality).toBeChecked();
  const directSteering = settings.getByRole('radio', { name: 'Directa' });
  await settings.getByText('Directa', { exact: true }).click();
  await expect(directSteering).toBeChecked();
  await settings.getByRole('slider', { name: 'Volumen general' }).fill('0.45');
  await settings
    .getByRole('checkbox', { name: /Reducir efectos sonoros/ })
    .check();
  await settings.getByRole('checkbox', { name: /Reducir movimiento/ }).check();
  await settings.getByRole('button', { name: 'Listo' }).click();

  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Conduce la expedición' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(
    page.getByRole('heading', { name: 'Sigue señales y objetivos' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Comenzar' }).click();

  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
  await expect(page.locator('.map-frame')).toHaveAttribute(
    'data-player-renderer',
    /^(ready|fallback)$/,
    { timeout: 20_000 },
  );
  await page.keyboard.press('Escape');

  const pauseMenu = page.getByRole('dialog', { name: 'Partida en pausa' });
  await expect(pauseMenu).toBeVisible();
  await pauseMenu.getByRole('button', { name: 'Configuración' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Configuración' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar configuración' }).click();
  await pauseMenu.getByRole('button', { name: 'Continuar' }).click();
  await expect(pauseMenu).toBeHidden();
});

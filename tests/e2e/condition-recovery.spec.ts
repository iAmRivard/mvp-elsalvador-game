import { expect, test } from '@playwright/test';

const saveKey = 'el-salvador-rutas-perdidas:save';
const pendingSaveKey = 'e2e:condition-pending-save';

async function installPendingSaveBridge(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ({ gameSaveKey, pendingKey }) => {
      const pendingSave = window.sessionStorage.getItem(pendingKey);
      if (!pendingSave) return;
      window.localStorage.setItem(gameSaveKey, pendingSave);
      window.sessionStorage.removeItem(pendingKey);
    },
    { gameSaveKey: saveKey, pendingKey: pendingSaveKey },
  );
}

async function startFresh(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  const skip = page.getByRole('button', { name: 'Omitir' });
  if (await skip.isVisible()) await skip.click();
  const beginMission = page.getByRole('button', {
    name: /Comenzar investigación/,
  });
  if (await beginMission.isVisible()) await beginMission.click();
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Partida y guardado' }).click();
  await page.getByRole('menuitem', { name: 'Guardar ahora' }).click();
}

test('conserva condición cero válida y recupera el vehículo', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await installPendingSaveBridge(page);
  await startFresh(page);
  await page.evaluate(
    ({ key, pendingKey }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) throw new Error('No se creó el guardado de prueba.');
      const envelope = JSON.parse(raw) as {
        game: {
          vehicle: Record<string, unknown>;
          experience: number;
          inventory: Array<{ itemId: string; quantity: number }>;
          lastSafeCheckpoint: {
            inventory: Array<{ itemId: string; quantity: number }>;
          };
        };
      };
      envelope.game.vehicle.condition = 0;
      envelope.game.experience = 650;
      envelope.game.inventory = [{ itemId: 'bidon-combustible', quantity: 2 }];
      envelope.game.lastSafeCheckpoint.inventory = [
        { itemId: 'bidon-combustible', quantity: 2 },
      ];
      window.sessionStorage.setItem(pendingKey, JSON.stringify(envelope));
    },
    { key: saveKey, pendingKey: pendingSaveKey },
  );

  await page.reload();
  await page.getByRole('button', { name: 'Continuar expedición' }).click();
  await expect(
    page.getByRole('heading', { name: 'Vehículo averiado' }),
  ).toBeVisible();
  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute('data-vehicle-condition', '0.0');
  await expect(page.getByRole('button', { name: 'Turbo' })).toBeDisabled();
  await expect(gameMap).toHaveAttribute('data-input-auto-throttle', 'off', {
    timeout: 20_000,
  });

  await page.getByRole('button', { name: 'Recuperar vehículo' }).click();
  await expect(
    page.getByRole('heading', { name: 'Vehículo averiado' }),
  ).toBeHidden();
  await expect(gameMap).toHaveAttribute('data-vehicle-condition', '35.0');
  await page.getByRole('button', { name: 'Partida y guardado' }).click();
  await page.getByRole('menuitem', { name: 'Inventario' }).click();
  const inventory = page.getByRole('dialog', { name: 'Inventario' });
  await expect(inventory).toContainText('Bidón de combustible');
  await expect(inventory).toContainText('2');
});

test('migra un guardado sin condición a 100 sin abrir recuperación', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  await installPendingSaveBridge(page);
  await startFresh(page);
  await page.evaluate(
    ({ key, pendingKey }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) throw new Error('No se creó el guardado de prueba.');
      const envelope = JSON.parse(raw) as {
        game: {
          vehicle: Record<string, unknown>;
          experience: number;
        };
      };
      delete envelope.game.vehicle.condition;
      envelope.game.experience = 200;
      window.sessionStorage.setItem(pendingKey, JSON.stringify(envelope));
    },
    { key: saveKey, pendingKey: pendingSaveKey },
  );

  await page.reload();
  await page.getByRole('button', { name: 'Continuar expedición' }).click();
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-vehicle-condition',
    '100.0',
  );
  await expect(
    page.getByRole('heading', { name: 'Vehículo averiado' }),
  ).toHaveCount(0);
});

import { expect, type Page, test } from '@playwright/test';

const saveKey = 'el-salvador-rutas-perdidas:save';
const settingsKey = 'el-salvador-rutas-perdidas:settings';
const pendingSaveKey = 'e2e:pending-save';
const station = [-89.447361, 13.8408999] as const;

interface SeedOptions {
  activeMissionId?: string | null;
  completedObjectiveIds?: string[];
  completedMissionIds?: string[];
  inventory?: { itemId: string; quantity: number }[];
  position?: readonly [number, number];
  fuel?: number;
}

function saveEnvelope(options: SeedOptions) {
  const fuel = options.fuel ?? 70;
  const position = options.position ?? station;
  return {
    version: 2,
    savedAt: '2026-07-13T20:00:00.000Z',
    game: {
      player: {
        longitude: position[0],
        latitude: position[1],
        heading: 0,
        speedMetersPerSecond: 0,
        fuel,
        totalDistanceMeters: 30_000,
      },
      energy: 100,
      maxEnergy: 100,
      experience: 370,
      activeMissionId: options.activeMissionId ?? null,
      activeMissionCompletedObjectiveIds: options.completedObjectiveIds ?? [],
      activeMissionObjectiveProgress: {},
      completedMissionIds: options.completedMissionIds ?? [
        'la-transmision',
        'camino-hacia-santa-ana',
      ],
      discoveredLocationIds: ['san-salvador', 'repetidor-las-delicias'],
      unlockedLocationIds: [
        'san-salvador',
        'repetidor-las-delicias',
        'estacion-el-congo',
      ],
      specialItemIds: [],
      unlockedStoryIds: [],
      inventory: options.inventory ?? [],
      vehicle: { condition: 100, fuel, maximumFuel: 100 },
      currentChapterId: 'chapter-1',
      completedChapterIds: [],
      roadNetworkVersion: 1,
      isPaused: false,
      isFollowingPlayer: true,
    },
  };
}

async function installSave(page: Page, options: SeedOptions) {
  await page.evaluate(
    ({ key, save }) => window.sessionStorage.setItem(key, JSON.stringify(save)),
    { key: pendingSaveKey, save: saveEnvelope(options) },
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continuar expedición' }).click();
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
}

async function interact(page: Page) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const touchAction = page.locator('.touch-button--interact');
    if (await touchAction.isVisible()) {
      try {
        await touchAction.click({ timeout: 1_500 });
      } catch {
        await page.keyboard.down('Space');
        await page.waitForTimeout(320);
        await page.keyboard.up('Space');
      }
    } else {
      await page.keyboard.down('Space');
      await page.waitForTimeout(320);
      await page.keyboard.up('Space');
    }
    await page.waitForTimeout(120);
  }
}

async function expandMissions(page: Page) {
  const expand = page.getByRole('button', {
    name: 'Expandir panel de misiones',
  });
  const details = page.getByRole('button', { name: 'Ver detalles' });
  if (await details.isVisible()) await details.click();
  else if (await expand.isVisible()) await expand.click();
}

async function openInventory(page: Page) {
  const desktopButton = page.getByRole('button', { name: 'Inventario' });
  if (await desktopButton.isVisible()) {
    await desktopButton.click();
    return;
  }
  await page.getByRole('button', { name: 'Partida y guardado' }).click();
  await page.getByRole('menuitem', { name: 'Inventario' }).click();
}

test('recoge combustible, repara el vehículo y completa misiones', async ({
  page,
}) => {
  await page.addInitScript(
    ({ gameSaveKey, pendingKey }) => {
      const pendingSave = window.sessionStorage.getItem(pendingKey);
      if (!pendingSave) return;
      window.localStorage.setItem(gameSaveKey, pendingSave);
      window.sessionStorage.removeItem(pendingKey);
    },
    { gameSaveKey: saveKey, pendingKey: pendingSaveKey },
  );
  await page.goto('/');
  await page.evaluate(
    ({ key, settings }) =>
      window.localStorage.setItem(key, JSON.stringify(settings)),
    {
      key: settingsKey,
      settings: {
        version: 8,
        settings: {
          graphicsQuality: 'low',
          reduceMotion: true,
          ambientFog: false,
          tutorialSeen: true,
          steeringSensitivity: 'medium',
          roadAssistMode: 'soft',
          audioMasterVolume: 0,
          audioEffectsVolume: 0,
          audioMusicVolume: 0,
          audioMuted: true,
          musicMuted: true,
          reduceAudioEffects: true,
          recommendedControlsPromptDismissed: true,
          singleDriveJoystickPromptDismissed: true,
          targetSpeedJoystickPromptDismissed: true,
          controlMode: 'target-speed-joystick',
        },
      },
    },
  );
  await installSave(page, {});
  await expandMissions(page);

  const stationMission = page.locator('.mission-list__item').filter({
    has: page.getByRole('heading', { name: 'Estación abandonada' }),
  });
  await stationMission.getByRole('button', { name: 'Iniciar' }).click();
  await expect(page.locator('.radio-message')).toContainText(
    'La estación sigue emitiendo',
  );
  await page.getByRole('button', { name: 'Cerrar transmisión' }).click();
  await interact(page);
  await expect(
    page.locator('.mission-objectives li.is-completed').filter({
      hasText: 'Investiga la estación abandonada',
    }),
  ).toBeVisible();

  await installSave(page, {
    activeMissionId: 'estacion-abandonada',
    completedObjectiveIds: ['investigar-estacion'],
    position: [-89.44672, 13.84092],
  });
  await interact(page);
  await openInventory(page);
  const inventory = page.getByRole('dialog', { name: 'Inventario' });
  await expect(inventory).toContainText('Bidón de combustible');
  await inventory.getByRole('button', { name: 'Cerrar inventario' }).click();

  await installSave(page, {
    activeMissionId: 'estacion-abandonada',
    completedObjectiveIds: ['investigar-estacion', 'recoger-bidon'],
    inventory: [{ itemId: 'bidon-combustible', quantity: 1 }],
    position: [-89.4479, 13.84048],
  });
  await interact(page);
  await openInventory(page);
  await expect(page.getByRole('dialog', { name: 'Inventario' })).toContainText(
    'Relé de encendido',
  );
  await page.getByRole('button', { name: 'Cerrar inventario' }).click();

  await installSave(page, {
    activeMissionId: 'estacion-abandonada',
    completedObjectiveIds: [
      'investigar-estacion',
      'recoger-bidon',
      'recoger-rele',
    ],
    inventory: [
      { itemId: 'bidon-combustible', quantity: 1 },
      { itemId: 'rele-encendido', quantity: 1 },
    ],
    fuel: 30,
  });
  await interact(page);
  await expect(page.locator('.mission-toast')).toContainText(
    'Estación abandonada',
  );
  await expect(
    page.getByRole('meter', { name: 'Combustible restante' }),
  ).toHaveAttribute('aria-valuenow', '75');
  await page
    .locator('.mission-toast')
    .getByRole('button', { name: 'Iniciar Reparación de emergencia' })
    .click();
  await expect(page.locator('.radio-message')).toContainText(
    'Encendido inestable',
  );
  await page.getByRole('button', { name: 'Cerrar transmisión' }).click();
  await expect(
    page.getByRole('meter', { name: 'Condición del vehículo' }),
  ).toHaveAttribute('aria-valuenow', '55');
  await interact(page);
  await expect(page.locator('.mission-toast')).toContainText(
    'Reparación de emergencia',
  );
  await expect(
    page.getByRole('meter', { name: 'Condición del vehículo' }),
  ).toHaveAttribute('aria-valuenow', '100');
  await openInventory(page);
  await expect(page.getByRole('dialog', { name: 'Inventario' })).toContainText(
    'No llevas objetos',
  );
});

import { expect, test } from '@playwright/test';

const saveKey = 'el-salvador-rutas-perdidas:save';

function installGarageSave(): void {
  if (
    window.sessionStorage.getItem('arcade-garage-save-installed') === 'true'
  ) {
    return;
  }
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.sessionStorage.setItem('arcade-garage-save-installed', 'true');
  window.localStorage.setItem(
    'el-salvador-rutas-perdidas:save',
    JSON.stringify({
      version: 5,
      savedAt: '2026-07-17T00:00:00.000Z',
      game: {
        onboardingState: 'completed',
        player: {
          longitude: -89.1908911,
          latitude: 13.6962937,
          heading: 0,
          speedMetersPerSecond: 0,
          fuel: 75,
          totalDistanceMeters: 1_250,
        },
        energy: 100,
        maxEnergy: 100,
        experience: 150,
        activeMissionId: null,
        activeMissionCompletedObjectiveIds: [],
        activeMissionObjectiveProgress: {},
        missionChoiceSelections: {},
        storyLogEntries: [],
        completedMissionIds: ['la-transmision'],
        discoveredLocationIds: ['san-salvador'],
        unlockedLocationIds: ['san-salvador'],
        specialItemIds: [],
        unlockedStoryIds: [],
        inventory: [],
        vehicle: { condition: 100, fuel: 75, maximumFuel: 100 },
        currentChapterId: 'chapter-1',
        completedChapterIds: [],
        navigationTarget: null,
        roadNetworkVersion: 2,
        isPaused: false,
        isFollowingPlayer: true,
      },
    }),
  );
  window.localStorage.setItem(
    'el-salvador-rutas-perdidas:settings',
    JSON.stringify({
      version: 9,
      settings: {
        graphicsQuality: 'medium',
        reduceMotion: true,
        ambientFog: false,
        tutorialSeen: true,
        steeringSensitivity: 'medium',
        roadAssistMode: 'soft',
        audioMuted: true,
        musicMuted: true,
        controlMode: 'arcade-driving',
        recommendedControlsPromptDismissed: true,
        singleDriveJoystickPromptDismissed: true,
        targetSpeedJoystickPromptDismissed: true,
        arcadeDrivingPromptDismissed: true,
      },
    }),
  );
}

test('selecciona y persiste vehículo sin recargar recursos Three.js', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  const vehicleRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/models/expedition-vehicle.glb')) {
      vehicleRequests.push(request.url());
    }
  });
  await page.addInitScript(installGarageSave);
  await page.goto('/');

  expect(vehicleRequests).toHaveLength(0);
  await page.getByRole('button', { name: 'Garaje' }).click();
  const garage = page.getByRole('dialog', { name: 'Garaje' });
  await expect(garage).toBeVisible();
  await garage.getByRole('button', { name: 'Seleccionar Volcán GT' }).click();
  await garage.getByText('Obsidiana', { exact: true }).click();
  await garage.getByRole('button', { name: 'Confirmar vehículo' }).click();

  const selectedBeforeDriving = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const save = JSON.parse(raw) as {
      version: number;
      game: {
        selectedVehicleId: string;
        selectedVehicleSkinId: string;
        unlockedVehicleIds: string[];
      };
    };
    return {
      version: save.version,
      vehicle: save.game.selectedVehicleId,
      skin: save.game.selectedVehicleSkinId,
      unlocked: save.game.unlockedVehicleIds,
    };
  }, saveKey);
  expect(selectedBeforeDriving).toEqual({
    version: 6,
    vehicle: 'volcan-gt',
    skin: 'volcan-obsidian',
    unlocked: ['torogoz', 'volcan-gt'],
  });
  expect(vehicleRequests).toHaveLength(0);

  await page.getByRole('button', { name: 'Continuar expedición' }).click();
  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute(
    'data-selected-vehicle-id',
    'volcan-gt',
  );
  await expect(gameMap).toHaveAttribute(
    'data-selected-vehicle-skin-id',
    'volcan-obsidian',
  );
  await expect(page.locator('.map-frame')).toHaveAttribute(
    'data-player-renderer',
    /^(ready|fallback)$/,
    {
      timeout: 20_000,
    },
  );
  await expect.poll(() => vehicleRequests.length).toBe(1);
  await page.locator('.maplibregl-canvas').evaluate((canvas) => {
    (window as Window & { __garageCanvas?: Element }).__garageCanvas = canvas;
  });

  await page.keyboard.press('Escape');
  const pause = page.getByRole('dialog', { name: 'Partida en pausa' });
  await pause.getByRole('button', { name: 'Garaje' }).click();
  const positionBeforeEscape = await gameMap.evaluate((element) => ({
    longitude: element.getAttribute('data-player-longitude'),
    latitude: element.getAttribute('data-player-latitude'),
  }));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Garaje' })).toBeHidden();
  await expect(pause).toBeVisible();
  await expect(gameMap).toHaveAttribute('data-runtime-blocked-by', 'pause');
  await page.waitForTimeout(350);
  expect(
    await gameMap.evaluate((element) => ({
      longitude: element.getAttribute('data-player-longitude'),
      latitude: element.getAttribute('data-player-latitude'),
    })),
  ).toEqual(positionBeforeEscape);

  await pause.getByRole('button', { name: 'Garaje' }).click();
  await expect(
    page.getByRole('button', { name: 'Coyote 4x4 · Bloqueado' }),
  ).toBeDisabled();
  await page.getByText('Magma', { exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar vehículo' }).click();
  await expect(gameMap).toHaveAttribute(
    'data-selected-vehicle-skin-id',
    'volcan-crimson',
  );
  expect(
    await page
      .locator('.maplibregl-canvas')
      .evaluate(
        (canvas) =>
          (window as Window & { __garageCanvas?: Element }).__garageCanvas ===
          canvas,
      ),
  ).toBe(true);
  expect(vehicleRequests).toHaveLength(1);

  await page.reload();
  await page.getByRole('button', { name: 'Continuar expedición' }).click();
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-selected-vehicle-skin-id',
    'volcan-crimson',
  );
});

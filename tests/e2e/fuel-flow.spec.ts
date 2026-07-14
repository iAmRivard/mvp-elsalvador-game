import { expect, type Page, test } from '@playwright/test';

const saveKey = 'el-salvador-rutas-perdidas:save';
const settingsKey = 'el-salvador-rutas-perdidas:settings';
const capitalStation = [-89.193303, 13.699119] as const;
const initialPosition = [-89.1908911, 13.6962937] as const;

function saveEnvelope(position: readonly [number, number], fuel: number) {
  return {
    version: 3,
    savedAt: '2026-07-14T12:00:00.000Z',
    game: {
      player: {
        longitude: position[0],
        latitude: position[1],
        heading: 0,
        speedMetersPerSecond: 0,
        fuel,
        totalDistanceMeters: 1_000,
      },
      energy: 100,
      maxEnergy: 100,
      experience: 0,
      activeMissionId: 'la-transmision',
      activeMissionCompletedObjectiveIds: [],
      activeMissionObjectiveProgress: {},
      missionChoiceSelections: {},
      storyLogEntries: [],
      completedMissionIds: [],
      discoveredLocationIds: ['san-salvador'],
      unlockedLocationIds: [
        'san-salvador',
        'repetidor-las-delicias',
        'santa-ana',
        'san-miguel',
        'santa-tecla',
        'suchitoto',
        'el-tunco',
      ],
      specialItemIds: [],
      unlockedStoryIds: [],
      inventory: [{ itemId: 'bidon-combustible', quantity: 1 }],
      vehicle: { condition: 100, fuel, maximumFuel: 100 },
      currentChapterId: 'chapter-1',
      completedChapterIds: [],
      roadNetworkVersion: 2,
      isPaused: false,
      isFollowingPlayer: true,
    },
  };
}

async function openSavedGame(
  page: Page,
  position: readonly [number, number],
  fuel: number,
) {
  await page.addInitScript(
    ({ gameSaveKey, storedSettingsKey, save }) => {
      window.localStorage.setItem(gameSaveKey, JSON.stringify(save));
      window.localStorage.setItem(
        storedSettingsKey,
        JSON.stringify({
          version: 7,
          settings: {
            graphicsQuality: 'low',
            reduceMotion: true,
            ambientFog: false,
            tutorialSeen: true,
            audioMasterVolume: 0,
            audioEffectsVolume: 0,
            audioMusicVolume: 0,
            audioMuted: true,
            musicMuted: true,
            reduceAudioEffects: true,
            recommendedControlsPromptDismissed: true,
            singleDriveJoystickPromptDismissed: true,
          },
        }),
      );
    },
    {
      gameSaveKey: saveKey,
      storedSettingsKey: settingsKey,
      save: saveEnvelope(position, fuel),
    },
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar expedición' }).click();
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-road-network-status',
    'ready',
    { timeout: 20_000 },
  );
}

test('marca una ruta vial real hacia la estación desde 20%', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await openSavedGame(page, initialPosition, 20);

  const assist = page.getByTestId('fuel-assist');
  await expect(assist.getByText('Combustible bajo')).toBeVisible();
  await expect(assist.getByText(/Estación más cercana:/)).toBeVisible();
  await assist.getByRole('button', { name: 'Marcar ruta' }).click();

  const map = page.getByTestId('game-map');
  await expect(map).toHaveAttribute(
    'data-navigation-target-kind',
    'fuel-station',
  );
  await expect(map).toHaveAttribute('data-mission-route-mode', 'road', {
    timeout: 20_000,
  });
  await expect
    .poll(async () =>
      Number(await map.getAttribute('data-mission-route-coordinate-count')),
    )
    .toBeGreaterThan(1);
  await expect(
    page.getByRole('button', { name: 'Volver a misión' }),
  ).toBeVisible();
});

test('recarga en el marcador y recupera la ruta de misión', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await openSavedGame(page, capitalStation, 18);
  const map = page.getByTestId('game-map');

  await expect(page.getByText('Punto de combustible')).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Punto de abastecimiento San Salvador, disponible',
    })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await page.getByRole('button', { name: 'Marcar ruta' }).click();
  await expect(map).toHaveAttribute(
    'data-navigation-target-kind',
    'fuel-station',
  );

  await page.getByRole('button', { name: 'Recargar' }).click();
  await expect(page.locator('.fuel-readout__header strong')).toHaveText(
    '63.0%',
  );
  await expect(map).toHaveAttribute(
    'data-navigation-target-kind',
    'mission-objective',
    { timeout: 20_000 },
  );
  await expect(page.getByText('Combustible +45%')).toBeVisible();
});

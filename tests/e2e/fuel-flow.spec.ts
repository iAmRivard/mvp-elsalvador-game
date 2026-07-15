import { expect, type Page, test } from '@playwright/test';

const saveKey = 'el-salvador-rutas-perdidas:save';
const settingsKey = 'el-salvador-rutas-perdidas:settings';
const capitalStation = [-89.193303, 13.699119] as const;
const initialPosition = [-89.1908911, 13.6962937] as const;

function saveEnvelope(position: readonly [number, number], fuel: number) {
  return {
    version: 4,
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
      navigationTarget: null,
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
      if (window.sessionStorage.getItem('fuel-flow-seeded') === 'true') return;
      window.sessionStorage.setItem('fuel-flow-seeded', 'true');
      window.localStorage.setItem(gameSaveKey, JSON.stringify(save));
      window.localStorage.setItem(
        storedSettingsKey,
        JSON.stringify({
          version: 8,
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
            targetSpeedJoystickPromptDismissed: true,
            controlMode: 'target-speed-joystick',
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

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

test('oculta asistencia extra con 75% de combustible', async ({
  page,
}, testInfo) => {
  await openSavedGame(page, initialPosition, 75);

  await expect(page.getByTestId('fuel-assist')).toHaveCount(0);
  if (testInfo.project.name === 'chromium-desktop') {
    await expect(page.locator('.fuel-readout__header strong')).toHaveText(
      '75.0%',
    );
  } else {
    await expect(page.getByLabel('Combustible 75 por ciento')).toBeVisible();
  }
});

test('muestra estación discreta y distancia con 30%', async ({ page }) => {
  await openSavedGame(page, initialPosition, 30);

  const assist = page.getByTestId('fuel-assist');
  await expect(assist).toHaveClass(/fuel-assist--nearby/);
  await expect(assist).toContainText('Estación cercana');
  await expect(assist).toContainText(/· \d+(\.\d+)? (m|km)/);
  await expect(
    assist.getByRole('button', { name: /Estación cercana/ }),
  ).toBeVisible();
});

test('marca una ruta vial real hacia la estación desde 20%', async ({
  page,
}, testInfo) => {
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
  await page.getByRole('button', { name: 'Partida y guardado' }).click();
  await page.getByRole('menuitem', { name: 'Guardar ahora' }).click();
  await expect(page.getByText('Partida guardada')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continuar expedición' }).click();
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-navigation-target-kind',
    'fuel-station',
    { timeout: 20_000 },
  );
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-mission-route-mode',
    'road',
    { timeout: 20_000 },
  );
  await expect(
    page.getByRole('button', { name: 'Volver a misión' }),
  ).toBeVisible();
  if (testInfo.project.name !== 'chromium-desktop') {
    const assistBox = await assist.boundingBox();
    const joystickBox = await page
      .getByLabel('Joystick de velocidad objetivo')
      .boundingBox();
    const actionsBox = await page
      .locator('.touch-actions--analog')
      .boundingBox();
    expect(assistBox).not.toBeNull();
    expect(joystickBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(rectanglesOverlap(assistBox!, joystickBox!)).toBe(false);
    expect(rectanglesOverlap(assistBox!, actionsBox!)).toBe(false);
  }
});

test('recarga en el marcador y recupera la ruta de misión', async ({
  page,
}, testInfo) => {
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
  if (testInfo.project.name === 'chromium-desktop') {
    await expect(page.locator('.fuel-readout__header strong')).toHaveText(
      '63.0%',
    );
  } else {
    await expect(page.getByLabel('Combustible 63 por ciento')).toBeVisible();
  }
  await expect(map).toHaveAttribute(
    'data-navigation-target-kind',
    'mission-objective',
    { timeout: 20_000 },
  );
  await expect(page.getByText('Combustible +45%')).toBeVisible();
});

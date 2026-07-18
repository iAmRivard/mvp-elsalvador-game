import { expect, test } from '@playwright/test';

interface PreparedSaveScenario {
  longitude: number;
  latitude: number;
  activeMissionId: string;
  completedObjectiveIds: string[];
}

function installPreparedSave(scenario: PreparedSaveScenario): void {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem(
    'el-salvador-rutas-perdidas:save',
    JSON.stringify({
      version: 4,
      savedAt: '2026-07-17T00:00:00.000Z',
      game: {
        onboardingState: 'completed',
        player: {
          longitude: scenario.longitude,
          latitude: scenario.latitude,
          heading: 172,
          speedMetersPerSecond: 0,
          fuel: 75,
          totalDistanceMeters: 1_000,
        },
        energy: 100,
        maxEnergy: 100,
        experience: 0,
        activeMissionId: scenario.activeMissionId,
        activeMissionCompletedObjectiveIds: scenario.completedObjectiveIds,
        activeMissionObjectiveProgress: {},
        missionChoiceSelections: {},
        storyLogEntries: [],
        completedMissionIds: [],
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
        graphicsQuality: 'low',
        reduceMotion: true,
        ambientFog: false,
        tutorialSeen: true,
        steeringSensitivity: 'high',
        roadAssistMode: 'off',
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

test('reincorpora una posición preparada cerca de una vía sin castigo', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  test.setTimeout(45_000);
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class DelayedRouteWorker extends NativeWorker {
      postMessage(
        message: unknown,
        options?: StructuredSerializeOptions | Transferable[],
      ): void {
        if (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'calculate-route'
        ) {
          window.setTimeout(() => super.postMessage(message), 5_000);
          return;
        }
        super.postMessage(message, options as StructuredSerializeOptions);
      }
    };
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(
      'el-salvador-rutas-perdidas:save',
      JSON.stringify({
        version: 4,
        savedAt: '2026-07-17T00:00:00.000Z',
        game: {
          onboardingState: 'completed',
          player: {
            longitude: -89.3184778148991,
            latitude: 13.68211807441288,
            heading: 172,
            speedMetersPerSecond: 0,
            fuel: 75,
            totalDistanceMeters: 1_000,
          },
          energy: 100,
          maxEnergy: 100,
          experience: 0,
          activeMissionId: 'la-transmision',
          activeMissionCompletedObjectiveIds: ['sintonizar-transmision'],
          activeMissionObjectiveProgress: {},
          missionChoiceSelections: {},
          storyLogEntries: [],
          completedMissionIds: [],
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
          graphicsQuality: 'low',
          reduceMotion: true,
          ambientFog: false,
          tutorialSeen: true,
          steeringSensitivity: 'high',
          roadAssistMode: 'off',
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
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar expedición' }).click();

  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready', {
    timeout: 20_000,
  });
  await expect(gameMap).toHaveAttribute(
    'data-road-contact-surface',
    'offroad',
    { timeout: 3_000 },
  );

  const rejoin = page.getByRole('button', { name: 'REINCORPORAR' });
  const rejoinDiagnostics = await gameMap.evaluate((element) => ({
    longitude: element.dataset.playerLongitude,
    latitude: element.dataset.playerLatitude,
    roadDistanceMeters: element.dataset.roadDistanceMeters,
    roadOffroadReason: element.dataset.roadOffroadReason,
  }));
  await testInfo.attach('route-rejoin-diagnostics.json', {
    body: JSON.stringify(rejoinDiagnostics),
    contentType: 'application/json',
  });
  await expect(page.locator('.stuck-vehicle-assist')).toHaveAttribute(
    'data-route-rejoin-blocked-by',
    '',
    { timeout: 3_000 },
  );
  await expect(gameMap).toHaveAttribute(
    'data-route-recalculating',
    'true',
  );
  await expect(rejoin).toBeVisible({ timeout: 3_000 });
  const positionBefore = await gameMap.evaluate(
    (element) =>
      `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
  );
  const fuelBefore = Number(await gameMap.getAttribute('data-player-fuel'));
  await rejoin.click();

  await expect(page.getByText('Vehículo reincorporado a la ruta')).toBeVisible();
  await expect(gameMap).toHaveAttribute('data-following-player', 'true');
  await expect
    .poll(() =>
      gameMap.evaluate(
        (element) =>
          `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
      ),
    )
    .not.toBe(positionBefore);
  await expect(gameMap).not.toHaveAttribute(
    'data-road-contact-surface',
    'offroad',
    { timeout: 3_000 },
  );
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road', {
    timeout: 10_000,
  });
  expect(Number(await gameMap.getAttribute('data-player-fuel'))).toBeCloseTo(
    fuelBefore,
    3,
  );
  const rejoinedPosition = await gameMap.evaluate((element) => [
    Number(element.dataset.playerLongitude),
    Number(element.dataset.playerLatitude),
  ]);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem(
          'el-salvador-rutas-perdidas:save',
        );
        if (!raw) return Number.NaN;
        const saved = JSON.parse(raw) as {
          game: { player: { longitude: number } };
        };
        return saved.game.player.longitude;
      }),
    )
    .toBeCloseTo(rejoinedPosition[0], 6);

  const context = page.context();
  await page.close();
  const reloadedPage = await context.newPage();
  await reloadedPage.goto('/');
  await reloadedPage
    .getByRole('button', { name: 'Continuar expedición' })
    .click();
  const reloadedMap = reloadedPage.getByTestId('game-map');
  await expect(reloadedMap).toHaveAttribute(
    'data-road-network-status',
    'ready',
    { timeout: 20_000 },
  );
  await expect
    .poll(() =>
      reloadedMap.evaluate((element) =>
        Number(element.dataset.playerLongitude),
      ),
    )
    .toBeCloseTo(rejoinedPosition[0], 6);
});

test('no ofrece reincorporación cuando no hay una vía dentro del límite', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await page.addInitScript(installPreparedSave, {
    longitude: -89.32170556088153,
    latitude: 13.68049665541925,
    activeMissionId: 'la-transmision',
    completedObjectiveIds: ['sintonizar-transmision'],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar expedición' }).click();

  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready', {
    timeout: 20_000,
  });
  await expect(gameMap).toHaveAttribute(
    'data-road-contact-surface',
    'offroad',
    { timeout: 3_000 },
  );
  const positionBefore = await gameMap.evaluate((element) => [
    element.dataset.playerLongitude,
    element.dataset.playerLatitude,
  ]);
  const assist = page.locator('.stuck-vehicle-assist');
  await expect(assist).toHaveAttribute(
    'data-route-rejoin-blocked-by',
    'no-road',
    { timeout: 4_000 },
  );
  await expect(page.getByRole('button', { name: 'REINCORPORAR' })).toHaveCount(
    0,
  );
  expect(
    await gameMap.evaluate((element) => [
      element.dataset.playerLongitude,
      element.dataset.playerLatitude,
    ]),
  ).toEqual(positionBefore);
});

test('protege el objetivo offroad real de Suchitoto', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await page.addInitScript(installPreparedSave, {
    longitude: -89.025833,
    latitude: 13.936667,
    activeMissionId: 'senales-en-suchitoto',
    completedObjectiveIds: [],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar expedición' }).click();

  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready', {
    timeout: 20_000,
  });
  await expect(gameMap).toHaveAttribute(
    'data-road-contact-surface',
    'offroad',
    { timeout: 3_000 },
  );
  const positionBefore = await gameMap.evaluate((element) => [
    element.dataset.playerLongitude,
    element.dataset.playerLatitude,
  ]);
  const assist = page.locator('.stuck-vehicle-assist');
  await expect(assist).toHaveAttribute(
    'data-route-rejoin-blocked-by',
    'offroad-objective',
    { timeout: 4_000 },
  );
  await expect(page.getByRole('button', { name: 'REINCORPORAR' })).toHaveCount(
    0,
  );
  expect(
    await gameMap.evaluate((element) => [
      element.dataset.playerLongitude,
      element.dataset.playerLatitude,
    ]),
  ).toEqual(positionBefore);
});

import { expect, test } from '@playwright/test';

const saveKey = 'el-salvador-rutas-perdidas:save';
const settingsKey = 'el-salvador-rutas-perdidas:settings';
const videoUrbanPoint = [-89.1913911, 13.6957937] as const;

test('mantiene sobre vía el punto urbano reproducido del video', async ({
  page,
}) => {
  await page.addInitScript(
    ({ gameSaveKey, storedSettingsKey, position }) => {
      window.localStorage.setItem(
        gameSaveKey,
        JSON.stringify({
          version: 4,
          savedAt: '2026-07-14T20:00:00.000Z',
          game: {
            player: {
              longitude: position[0],
              latitude: position[1],
              heading: 0,
              speedMetersPerSecond: 0,
              fuel: 75,
              totalDistanceMeters: 0,
            },
            energy: 100,
            maxEnergy: 100,
            experience: 0,
            activeMissionId: null,
            activeMissionCompletedObjectiveIds: [],
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
            isFollowingPlayer: false,
          },
        }),
      );
      window.localStorage.setItem(
        storedSettingsKey,
        JSON.stringify({
          version: 8,
          settings: {
            graphicsQuality: 'low',
            reduceMotion: true,
            ambientFog: false,
            tutorialSeen: true,
            audioMuted: true,
            musicMuted: true,
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
      position: videoUrbanPoint,
    },
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar expedición' }).click();

  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready', {
    timeout: 20_000,
  });
  await expect(gameMap).toHaveAttribute('data-road-selected-edge', /^298[89]$/);
  await expect(gameMap).toHaveAttribute(
    'data-road-contact-surface',
    'secondary',
  );
  const distanceMeters = Number(
    await gameMap.getAttribute('data-road-distance-meters'),
  );
  expect(distanceMeters).toBeLessThanOrEqual(8);
  await expect(gameMap).toHaveAttribute('data-following-player', 'true');
  await expect(page.getByTestId('driving-surface')).toContainText(
    'Vía secundaria',
  );
  await expect(
    page.getByText('Fuera de carretera', { exact: true }),
  ).toHaveCount(0);
});

test('descarta una ruta si el vehiculo se mueve mientras calcula', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
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
          window.setTimeout(() => super.postMessage(message), 2_500);
          return;
        }
        if (Array.isArray(options)) {
          super.postMessage(message, options);
        } else {
          super.postMessage(message, options);
        }
      }
    };

    window.localStorage.setItem(
      'el-salvador-rutas-perdidas:save',
      JSON.stringify({
        version: 4,
        savedAt: '2026-07-16T20:00:00.000Z',
        game: {
          onboardingState: 'completed',
          player: {
            longitude: -89.1908911,
            latitude: 13.6962937,
            heading: 0,
            speedMetersPerSecond: 0,
            fuel: 72,
            totalDistanceMeters: 8_200,
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
          unlockedLocationIds: ['san-salvador'],
          specialItemIds: [],
          unlockedStoryIds: [],
          inventory: [],
          vehicle: { condition: 99, fuel: 72, maximumFuel: 100 },
          currentChapterId: 'chapter-1',
          completedChapterIds: [],
          navigationTarget: null,
          roadNetworkVersion: 2,
          isPaused: false,
          isFollowingPlayer: true,
        },
      }),
    );
  });

  await page.goto('/');
  await page.getByRole('button', { name: /Continuar expedici/ }).click();
  const gameMap = page.getByTestId('game-map');
  await page.keyboard.down('w');
  await page.keyboard.down('Shift');
  await expect(gameMap).toHaveAttribute('data-road-network-status', 'ready', {
    timeout: 20_000,
  });

  await expect
    .poll(
      async () => {
        await page.keyboard.down('w');
        await page.keyboard.down('Shift');
        return gameMap
          .getAttribute('data-player-speed-kilometers-per-hour')
          .then(Number);
      },
      { timeout: 10_000 },
    )
    .toBeGreaterThan(35);
  await expect
    .poll(
      () =>
        gameMap.getAttribute('data-route-discarded-stale-origins').then(Number),
      { timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(1);
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road');
  await expect
    .poll(
      () =>
        gameMap.getAttribute('data-route-discarded-stale-origins').then(Number),
      { timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(2);
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road');
  await page.keyboard.up('Shift');
  await page.keyboard.up('w');

  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road', {
    timeout: 15_000,
  });
  await expect
    .poll(async () => {
      const player = [
        Number(await gameMap.getAttribute('data-player-longitude')),
        Number(await gameMap.getAttribute('data-player-latitude')),
      ];
      const navigation = [
        Number(
          await gameMap.getAttribute('data-navigation-last-position-longitude'),
        ),
        Number(
          await gameMap.getAttribute('data-navigation-last-position-latitude'),
        ),
      ];
      return Math.hypot(player[0] - navigation[0], player[1] - navigation[1]);
    })
    .toBeLessThan(0.000_01);
});

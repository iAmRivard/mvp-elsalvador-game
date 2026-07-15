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
            isFollowingPlayer: true,
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
  await expect(gameMap).toHaveAttribute(
    'data-road-selected-edge',
    /^298[89]$/,
  );
  await expect(gameMap).toHaveAttribute(
    'data-road-contact-surface',
    'secondary',
  );
  const distanceMeters = Number(
    await gameMap.getAttribute('data-road-distance-meters'),
  );
  expect(distanceMeters).toBeGreaterThan(0);
  expect(distanceMeters).toBeLessThanOrEqual(52);
  await expect(page.getByTestId('driving-surface')).toContainText(
    'Vía secundaria',
  );
  await expect(page.getByText('Fuera de carretera', { exact: true })).toHaveCount(
    0,
  );
});

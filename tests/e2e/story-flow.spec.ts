import { expect, type Page, test } from '@playwright/test';

const saveKey = 'el-salvador-rutas-perdidas:save';
const settingsKey = 'el-salvador-rutas-perdidas:settings';
const pendingSaveKey = 'e2e:story-flow-pending-save';
const repeater = [-89.3175451, 13.6820687] as const;
const blockage = [-89.3592277, 13.7305749] as const;

interface SeedOptions {
  activeMissionId: string;
  completedObjectiveIds: string[];
  completedMissionIds: string[];
  position: readonly [number, number];
  fuel: number;
  missionChoiceSelections?: Record<string, string>;
  objectiveProgress?: Record<
    string,
    {
      value: number;
      target: number;
      elapsedSeconds: number;
      durationSeconds: number | null;
      selectedOptionId?: string;
    }
  >;
}

function saveEnvelope(options: SeedOptions) {
  return {
    version: 3,
    savedAt: '2026-07-14T12:00:00.000Z',
    game: {
      player: {
        longitude: options.position[0],
        latitude: options.position[1],
        heading: 0,
        speedMetersPerSecond: 0,
        fuel: options.fuel,
        totalDistanceMeters: 25_000,
      },
      energy: 100,
      maxEnergy: 100,
      experience: 150,
      activeMissionId: options.activeMissionId,
      activeMissionCompletedObjectiveIds: options.completedObjectiveIds,
      activeMissionObjectiveProgress: options.objectiveProgress ?? {},
      missionChoiceSelections: options.missionChoiceSelections ?? {},
      storyLogEntries: [],
      completedMissionIds: options.completedMissionIds,
      discoveredLocationIds: ['san-salvador', 'repetidor-las-delicias'],
      unlockedLocationIds: ['san-salvador', 'repetidor-las-delicias'],
      specialItemIds: [],
      unlockedStoryIds: [],
      inventory: [],
      vehicle: {
        condition: 100,
        fuel: options.fuel,
        maximumFuel: 100,
      },
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

async function pressInteraction(page: Page, holdMilliseconds = 35) {
  await page.keyboard.down('e');
  await page.waitForTimeout(holdMilliseconds);
  await page.keyboard.up('e');
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

test('guía la historia hasta la ruta cronometrada y conserva la decisión', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const applicationOrigin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin;
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== applicationOrigin) {
      externalRequests.push(request.url());
    }
  });
  await page.addInitScript(
    ({ gameSaveKey, pendingKey, storedSettingsKey }) => {
      const pendingSave = window.sessionStorage.getItem(pendingKey);
      if (pendingSave) {
        window.localStorage.setItem(gameSaveKey, pendingSave);
        window.sessionStorage.removeItem(pendingKey);
      }
      if (!window.localStorage.getItem(storedSettingsKey)) {
        window.localStorage.setItem(
          storedSettingsKey,
          JSON.stringify({
            version: 6,
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
            },
          }),
        );
      }
    },
    {
      gameSaveKey: saveKey,
      pendingKey: pendingSaveKey,
      storedSettingsKey: settingsKey,
    },
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: /Iniciar La transmisión$/ }).click();

  const introduction = page.getByRole('dialog', {
    name: 'Una señal de auxilio',
  });
  await expect(introduction).toContainText('JUEGO EN PAUSA');
  await expect(introduction).toContainText(
    'Tu misión es seguirla, descubrir quién la envía',
  );
  await expect(introduction).toContainText(
    'Acércate al marcador de radio y escucha la señal',
  );
  await introduction
    .getByRole('button', { name: 'Comenzar investigación' })
    .click();

  await pressInteraction(page);
  const radio = page.locator('.radio-message');
  await expect(radio).toContainText('La señal continúa al oeste');
  await expect(page.locator('.radio-overlay')).toHaveCSS(
    'pointer-events',
    'none',
  );
  await expect(radio).toHaveCSS('pointer-events', 'auto');
  const gameMap = page.getByTestId('game-map');
  await page.keyboard.down('w');
  await expect(gameMap).toHaveAttribute('data-input-throttle', '1.000');
  await page.keyboard.up('w');
  await page.getByRole('button', { name: 'Cerrar transmisión' }).click();

  await installSave(page, {
    activeMissionId: 'la-transmision',
    completedObjectiveIds: ['sintonizar-transmision', 'llegar-repetidor-oeste'],
    completedMissionIds: [],
    position: repeater,
    fuel: 61,
  });
  await pressInteraction(page, 80);
  const completion = page.locator('.mission-toast');
  await expect(completion).toContainText('Misión completada');
  await expect(completion).toContainText('La señal continúa hacia Santa Ana');
  await completion
    .getByRole('button', { name: 'Iniciar Camino bloqueado' })
    .click();
  await expect(page.locator('.radio-message')).toContainText(
    'Advertencia en la carretera',
  );
  await expect(
    page.getByRole('heading', { name: 'Camino bloqueado', exact: true }),
  ).toBeAttached();

  await installSave(page, {
    activeMissionId: 'camino-hacia-santa-ana',
    completedObjectiveIds: ['llegar-al-bloqueo'],
    completedMissionIds: ['la-transmision'],
    position: blockage,
    fuel: 45,
  });
  await pressInteraction(page);
  const blockageRadio = page.locator('.radio-message');
  await expect(blockageRadio).toContainText('Dos desvíos disponibles');
  await page.getByRole('button', { name: 'Cerrar transmisión' }).click();
  await pressInteraction(page);
  const routeChoice = page.getByRole('dialog', { name: 'Elige el desvío' });
  await expect(routeChoice).toContainText('JUEGO EN PAUSA');
  await expect(routeChoice).toContainText('Ruta norte');
  await expect(routeChoice).toContainText('Ruta sur');
  const routeCountBefore = Number(
    (await gameMap.getAttribute('data-mission-route-coordinate-count')) ?? 0,
  );
  await routeChoice.getByRole('button', { name: /Ruta norte/ }).click();
  await expect(page.locator('.mission-countdown')).toContainText('PREPÁRATE');
  const timer = page.getByRole('timer');
  await expect(timer).toBeVisible({ timeout: 8_000 });
  await expect(timer).toContainText('SEÑAL INESTABLE');
  await expect(timer).toContainText(/04:\d{2}/);
  await expect(timer).toHaveAttribute('data-music-state', 'timed');
  await expect
    .poll(async () =>
      Number(
        (await gameMap.getAttribute('data-mission-route-coordinate-count')) ??
          0,
      ),
    )
    .toBeGreaterThan(10);
  expect(
    Number(await gameMap.getAttribute('data-mission-route-coordinate-count')),
  ).not.toBe(routeCountBefore);

  const timerBox = await timer.boundingBox();
  const hudBox = await page.locator('.player-hud').boundingBox();
  const viewport = page.viewportSize();
  expect(timerBox).not.toBeNull();
  expect(hudBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(rectanglesOverlap(timerBox!, hudBox!)).toBe(false);
  expect(timerBox!.x).toBeGreaterThanOrEqual(0);
  expect(timerBox!.y).toBeGreaterThanOrEqual(0);
  expect(timerBox!.x + timerBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(timerBox!.y + timerBox!.height).toBeLessThanOrEqual(viewport!.height);

  const fuelReadout = page.locator('.fuel-readout__header strong');
  const fuelBefore = Number.parseFloat(
    (await fuelReadout.textContent()) ?? '0',
  );
  await page.keyboard.down('w');
  await page.waitForTimeout(1_200);
  await page.keyboard.up('w');
  await expect
    .poll(async () =>
      Number.parseFloat((await fuelReadout.textContent()) ?? '0'),
    )
    .toBeLessThan(fuelBefore);

  await page.getByRole('button', { name: 'Partida y guardado' }).click();
  await page.getByRole('menuitem', { name: 'Guardar ahora' }).click();
  const persisted = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as {
      version: number;
      game: {
        activeMissionId: string | null;
        missionChoiceSelections: Record<string, string>;
        activeMissionObjectiveProgress: Record<
          string,
          { elapsedSeconds: number }
        >;
      };
    };
    return {
      version: envelope.version,
      activeMissionId: envelope.game.activeMissionId,
      selectedRoute:
        envelope.game.missionChoiceSelections['camino-hacia-santa-ana'],
      elapsedSeconds:
        envelope.game.activeMissionObjectiveProgress[
          'alcanzar-estacion-a-tiempo'
        ]?.elapsedSeconds ?? 0,
    };
  }, saveKey);
  expect(persisted).toMatchObject({
    version: 3,
    activeMissionId: 'camino-hacia-santa-ana',
    selectedRoute: 'north',
  });
  expect(persisted?.elapsedSeconds).toBeGreaterThan(0);

  await page.reload();
  await page.getByRole('button', { name: 'Continuar expedición' }).click();
  await expect(page.getByRole('timer')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('timer')).not.toContainText('04:30');
  expect(externalRequests).toEqual([]);
});

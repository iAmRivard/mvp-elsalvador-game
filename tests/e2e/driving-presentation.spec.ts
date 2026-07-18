import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  test,
} from '@playwright/test';
import { navigationGuidanceViewportMarginPixels } from '../../src/map/navigationGuidanceMarker';

interface ViewportCase {
  name: string;
  width: number;
  height: number;
}

const viewports: ViewportCase[] = [
  { name: 'reference-392', width: 392, height: 850 },
  { name: 'portrait', width: 412, height: 915 },
  { name: 'landscape', width: 850, height: 392 },
  { name: 'tablet', width: 768, height: 1_024 },
  { name: 'small', width: 360, height: 800 },
  { name: 'compact-portrait', width: 360, height: 640 },
];

async function enterExpedition(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  const narrative = page.getByRole('dialog', { name: 'Una señal de auxilio' });
  await expect(narrative).toBeVisible();
  await narrative
    .getByRole('button', { name: /Comenzar investigación/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Elige tu velocidad' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Omitir' }).click();
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-road-network-status',
    /ready|unavailable/,
    { timeout: 25_000 },
  );
  await expect(page.getByText('El mapa local está listo.')).toBeAttached({
    timeout: 25_000,
  });
  const closeRadio = page.getByRole('button', { name: 'Cerrar transmisión' });
  if (await closeRadio.isVisible()) await closeRadio.click();
}

async function enterMobileTutorial(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();
  const narrative = page.getByRole('dialog', { name: 'Una señal de auxilio' });
  await expect(narrative).toBeVisible();
  await narrative
    .getByRole('button', { name: /Comenzar investigación/ })
    .click();
  await expect(page.locator('.mobile-tutorial-card')).toBeVisible();
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-road-network-status',
    /ready|unavailable/,
    { timeout: 25_000 },
  );
}

async function expectTutorialOutsidePlayer(page: Page) {
  const geometry = await page.evaluate(() => {
    const map = document.querySelector<HTMLElement>('[data-testid="game-map"]');
    const tutorial = document.querySelector<HTMLElement>(
      '.mobile-tutorial-card',
    );
    if (!map || !tutorial) return null;
    const mapRect = map.getBoundingClientRect();
    const tutorialRect = tutorial.getBoundingClientRect();
    const playerX = mapRect.left + mapRect.width / 2;
    const playerY =
      mapRect.top +
      mapRect.height / 2 +
      Number(map.dataset.cameraAppliedScreenOffsetY ?? 0);
    const padding = 26;
    return {
      outside:
        playerX < tutorialRect.left - padding ||
        playerX > tutorialRect.right + padding ||
        playerY < tutorialRect.top - padding ||
        playerY > tutorialRect.bottom + padding,
      playerX,
      playerY,
      tutorial: {
        left: tutorialRect.left,
        right: tutorialRect.right,
        top: tutorialRect.top,
        bottom: tutorialRect.bottom,
      },
      safe: {
        y: map.dataset.safeViewportY,
        height: map.dataset.safeViewportHeight,
        offsetY: map.dataset.cameraAppliedScreenOffsetY,
        obstructed: map.dataset.safeViewportObstructed,
        occlusions: map.dataset.safeViewportOcclusionCount,
      },
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.outside, JSON.stringify(geometry)).toBe(true);
  return geometry!;
}

async function selectMobileTarget(
  context: BrowserContext,
  page: Page,
  targetSpeedKilometersPerHour: number,
  touchId: number,
) {
  const joystick = page.getByLabel('Joystick de conducción arcade');
  await expect(joystick).toBeVisible();
  const box = await joystick.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  const session = await context.newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: touchId, x: centerX, y: centerY, force: 1 }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          id: touchId,
          x: centerX,
          y: centerY - box!.width * 0.44,
          force: 1,
        },
      ],
    });
    await expect(page.getByTestId('mobile-driving-hud')).toBeVisible({
      timeout: 10_000,
    });
    await expect
      .poll(
        () =>
          page
            .getByTestId('game-map')
            .getAttribute('data-input-target-speed')
            .then(Number),
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(targetSpeedKilometersPerHour);
  } finally {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  }
}

async function selectFastMobileTarget(context: BrowserContext, page: Page) {
  await selectMobileTarget(context, page, 88, 1);
  const gameMap = page.getByTestId('game-map');
  await expect
    .poll(
      async () =>
        Number.parseFloat(
          (await page.getByTestId('mobile-driving-speed').textContent()) ?? '0',
        ),
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(58);
  await page.getByRole('button', { name: 'Turbo' }).click();
  await expect
    .poll(
      () =>
        gameMap
          .getAttribute('data-player-speed-kilometers-per-hour')
          .then(Number),
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(72);
  await expect(gameMap).toHaveAttribute(
    'data-current-camera-profile',
    'mobileFast',
  );
}

async function expectAppliedSafeCamera(
  gameMap: Locator,
  expectedProfile?: string | RegExp,
) {
  if (expectedProfile) {
    await expect(gameMap).toHaveAttribute(
      'data-current-camera-profile',
      expectedProfile,
    );
  }
  await expect(gameMap).toHaveAttribute(
    'data-follow-offset-y',
    /^-?\d+(?:\.\d+)?$/,
  );
  await expect(gameMap).toHaveAttribute(
    'data-camera-last-applied-offset-y',
    /^-?\d+(?:\.\d+)?$/,
  );
  await expect(gameMap).toHaveAttribute(
    'data-camera-last-operation',
    /^(easeTo|jumpTo-offset-center)$/,
  );
  await expect
    .poll(async () => {
      const [actual, requested] = await Promise.all([
        gameMap.getAttribute('data-camera-applied-screen-offset-y'),
        gameMap.getAttribute('data-follow-offset-y'),
      ]);
      return Math.abs(Number(actual) - Number(requested));
    })
    .toBeLessThanOrEqual(19.1);
  await expect(gameMap).toHaveAttribute(
    'data-player-outside-safe-viewport',
    'false',
  );
  const [safeRatio, usefulMapAreaRatio] = await Promise.all([
    gameMap.getAttribute('data-safe-player-y-ratio').then(Number),
    gameMap.getAttribute('data-useful-map-area-ratio').then(Number),
  ]);
  expect(safeRatio).toBeGreaterThanOrEqual(0.45);
  expect(safeRatio).toBeLessThanOrEqual(0.75);
  expect(usefulMapAreaRatio).toBeGreaterThanOrEqual(0.65);
}

async function expectFastRouteAnticipation(page: Page, gameMap: Locator) {
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road', {
    timeout: 20_000,
  });
  await expect
    .poll(() =>
      gameMap.getAttribute('data-mission-route-coordinate-count').then(Number),
    )
    .toBeGreaterThanOrEqual(2);
  await expect(gameMap).toHaveAttribute(
    'data-navigation-next-type',
    /^(continue|turn-left|turn-right|slight-left|slight-right|u-turn|arrive)$/,
  );
  await expect(gameMap).toHaveAttribute(
    'data-mission-route-road-color',
    '#28D7F5',
  );

  const routeArrow = page.locator('.mission-route-arrow');
  const instruction = page.locator('.mobile-driving-hud__copy strong');
  const objectiveAndDistance = page.locator('.mobile-driving-hud__copy small');
  await expect(instruction).toBeVisible();
  await expect(instruction).not.toHaveText('Sigue la ruta hacia el objetivo');
  await expect(objectiveAndDistance).toBeVisible();
  await expect(objectiveAndDistance).toHaveText(/.+ · \d+(?:\.\d+)? (?:m|km)$/);

  const guidanceSnapshot = await page.evaluate(() => {
    const map = document.querySelector<HTMLElement>('[data-testid="game-map"]');
    const arrow = document.querySelector<HTMLElement>('.mission-route-arrow');
    const player = document.querySelector<HTMLElement>('.player-marker');
    if (!map || !arrow || !player) return null;
    const mapRect = map.getBoundingClientRect();
    const arrowRect = arrow.getBoundingClientRect();
    const playerRect = player.getBoundingClientRect();
    const visible =
      map.dataset.navigationArrowVisible === 'true' &&
      !arrow.hidden &&
      arrowRect.width > 0 &&
      arrowRect.height > 0;
    const tolerance = 1;
    return {
      visible,
      hidden: arrow.hidden,
      fallback: map.dataset.navigationArrowFallback ?? '',
      nextDistance: Number(map.dataset.navigationNextDistance),
      screenX: Number(map.dataset.navigationArrowScreenX),
      screenY: Number(map.dataset.navigationArrowScreenY),
      viewportWidth: Number(map.dataset.navigationArrowViewportWidth),
      viewportHeight: Number(map.dataset.navigationArrowViewportHeight),
      inside:
        arrowRect.left >= mapRect.left - tolerance &&
        arrowRect.top >= mapRect.top - tolerance &&
        arrowRect.right <= mapRect.right + tolerance &&
        arrowRect.bottom <= mapRect.bottom + tolerance,
      separation: Math.hypot(
        arrowRect.left +
          arrowRect.width / 2 -
          (playerRect.left + playerRect.width / 2),
        arrowRect.top +
          arrowRect.height / 2 -
          (playerRect.top + playerRect.height / 2),
      ),
    };
  });
  expect(guidanceSnapshot).not.toBeNull();
  expect(guidanceSnapshot!.nextDistance).toBeGreaterThanOrEqual(0);
  const expectedVisible =
    guidanceSnapshot!.screenX >= navigationGuidanceViewportMarginPixels &&
    guidanceSnapshot!.screenX <=
      guidanceSnapshot!.viewportWidth - navigationGuidanceViewportMarginPixels &&
    guidanceSnapshot!.screenY >= navigationGuidanceViewportMarginPixels &&
    guidanceSnapshot!.screenY <=
      guidanceSnapshot!.viewportHeight -
        navigationGuidanceViewportMarginPixels;
  expect(guidanceSnapshot!.visible).toBe(expectedVisible);
  if (expectedVisible) {
    expect(guidanceSnapshot).toMatchObject({
      fallback: 'false',
      hidden: false,
      inside: true,
    });
    expect(guidanceSnapshot!.separation).toBeGreaterThan(12);
  } else {
    await expect(routeArrow).toBeHidden();
  }
}

async function stopMobileTarget(context: BrowserContext, page: Page) {
  const joystick = page.getByLabel('Joystick de conducción arcade');
  await expect(joystick).toBeVisible();
  const box = await joystick.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  const session = await context.newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 2, x: centerX, y: centerY, force: 1 }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          id: 2,
          x: centerX,
          y: centerY + box!.width * 0.44,
          force: 1,
        },
      ],
    });
    await expect
      .poll(
        async () =>
          Number(
            await page
              .getByTestId('game-map')
              .getAttribute('data-player-speed-kilometers-per-hour'),
          ),
        { timeout: 20_000 },
      )
      .toBeLessThan(2);
  } finally {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  }
}

for (const viewport of viewports) {
  test(`respeta el presupuesto de conducción en ${viewport.name}`, async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile');
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.addInitScript(() => window.localStorage.clear());
    await enterExpedition(page);

    await selectFastMobileTarget(context, page);
    const drivingHud = page.getByTestId('mobile-driving-hud');
    const gameMap = page.getByTestId('game-map');
    await expect(gameMap).toHaveAttribute('data-presentation-mode', 'fast');
    await expect(gameMap).toHaveAttribute(
      'data-map-declutter-profile',
      'arcade-fast',
    );
    await expect(gameMap).toHaveAttribute(
      'data-current-camera-profile',
      'mobileFast',
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-average-update-ms',
      /^\d+\.\d{3}$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-requested-updates',
      /^[1-9]\d*$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-applied-updates',
      /^[1-9]\d*$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-skipped-by-interval',
      /^\d+$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-skipped-by-tolerance',
      /^\d+$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-cadence-hertz',
      /^(20|30|45|60)$/,
    );
    await expect(gameMap).toHaveAttribute(
      'data-camera-safe-projection-updates',
      /^\d+$/,
    );
    await expect(gameMap).not.toHaveAttribute(
      'data-camera-p95-update-ms',
      /.+/,
    );
    await expect(gameMap).not.toHaveAttribute(
      'data-rendered-symbol-count',
      /.+/,
    );

    await expect(page.locator('.player-hud')).toBeHidden();
    await expect(page.getByTestId('mobile-mini-navigator')).toBeHidden();
    await expectFastRouteAnticipation(page, gameMap);

    const [hudBox, joystickBox, actionsBox] = await Promise.all([
      drivingHud.boundingBox(),
      page.getByLabel('Joystick de conducción arcade').boundingBox(),
      page.locator('.touch-actions').boundingBox(),
    ]);
    expect(hudBox).not.toBeNull();
    expect(joystickBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();

    for (const box of [hudBox!, joystickBox!, actionsBox!]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }

    const controlsTop = Math.min(joystickBox!.y, actionsBox!.y);
    const lowerControlRatio = (viewport.height - controlsTop) / viewport.height;
    const upperHudRatio = hudBox!.height / viewport.height;
    expect(upperHudRatio).toBeLessThanOrEqual(0.17);
    expect(lowerControlRatio).toBeLessThanOrEqual(0.27);
    expect(hudBox!.y + hudBox!.height).toBeLessThan(controlsTop);
    await expectAppliedSafeCamera(gameMap, 'mobileFast');

    const totalLayers = Number(
      await gameMap.getAttribute('data-map-layer-count'),
    );
    const visibleLayers = Number(
      await gameMap.getAttribute('data-map-visible-layer-count'),
    );
    expect(totalLayers).toBeGreaterThan(0);
    expect(visibleLayers).toBeGreaterThan(0);
    expect(visibleLayers).toBeLessThan(totalLayers);

    await testInfo.attach(`v0.3.0-${viewport.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
}

test('aplica el viewport seguro en interaction, driving, fast y stopped', async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await page.setViewportSize({ width: 392, height: 850 });
  await page.addInitScript(() => window.localStorage.clear());
  await enterExpedition(page);

  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute(
    'data-current-camera-profile',
    'mobileInteraction',
  );
  await expectAppliedSafeCamera(gameMap, 'mobileInteraction');

  await selectMobileTarget(context, page, 30, 3);
  await expect(gameMap).toHaveAttribute(
    'data-current-camera-profile',
    'mobileDriving',
    { timeout: 8_000 },
  );
  await expectAppliedSafeCamera(gameMap, 'mobileDriving');

  await selectFastMobileTarget(context, page);
  await expect(gameMap).toHaveAttribute(
    'data-current-camera-profile',
    'mobileFast',
    { timeout: 12_000 },
  );
  await expectAppliedSafeCamera(gameMap, 'mobileFast');

  await stopMobileTarget(context, page);
  await expectAppliedSafeCamera(gameMap, /mobile(Stopped|Interaction)/);
  await expect
    .poll(() =>
      gameMap.getAttribute('data-camera-profile-transitions').then(Number),
    )
    .toBeGreaterThanOrEqual(3);
});

test('recalcula y aplica el offset al cambiar el viewport', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await page.setViewportSize({ width: 392, height: 850 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    const state = {
      advicePresent: false,
      assistPresent: false,
      overlapObserved: false,
    };
    const contains = (node: Node, selector: string) =>
      node instanceof Element &&
      (node.matches(selector) || Boolean(node.querySelector(selector)));
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (contains(node, '.contextual-advice')) {
            state.advicePresent = false;
          }
          if (contains(node, '.stuck-vehicle-assist')) {
            state.assistPresent = false;
          }
        }
        for (const node of record.addedNodes) {
          if (contains(node, '.contextual-advice')) {
            state.advicePresent = true;
          }
          if (contains(node, '.stuck-vehicle-assist')) {
            state.assistPresent = true;
          }
        }
        state.overlapObserved ||= state.advicePresent && state.assistPresent;
      }
    });
    observer.observe(document, { childList: true, subtree: true });
    Object.assign(window, { __overlayOverlapState: state });
  });
  await enterExpedition(page);

  const gameMap = page.getByTestId('game-map');
  await expect(page.locator('.stuck-vehicle-assist')).toBeVisible({
    timeout: 3_000,
  });
  await expect(page.locator('.contextual-advice')).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __overlayOverlapState?: { overlapObserved: boolean };
          }
        ).__overlayOverlapState?.overlapObserved ?? false,
    ),
  ).toBe(false);
  const previousSafeHeight = Number(
    await gameMap.getAttribute('data-safe-viewport-height'),
  );
  await page.setViewportSize({ width: 392, height: 700 });
  await expect
    .poll(() => gameMap.getAttribute('data-safe-viewport-height').then(Number))
    .not.toBe(previousSafeHeight);
  await expect(page.locator('.stuck-vehicle-assist')).toBeVisible();
  await expect(page.locator('.contextual-advice')).toHaveCount(0);
  await expect(page.locator('.overlay-manager')).toHaveAttribute(
    'data-contextual-advice-suppressed',
    'true',
  );
  await expectAppliedSafeCamera(gameMap, 'mobileInteraction');

  await page.getByRole('button', { name: /^Cerrar ayuda de conducci/ }).click();
  await expect(page.locator('.stuck-vehicle-assist')).toBeHidden();
  await expect(page.locator('.overlay-manager')).toHaveAttribute(
    'data-contextual-advice-suppressed',
    'false',
  );
  await expect(page.locator('.contextual-advice')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __overlayOverlapState?: { overlapObserved: boolean };
          }
        ).__overlayOverlapState?.overlapObserved ?? false,
    ),
  ).toBe(false);
});

test('actualiza la visibilidad de la guia al rotar sin mover el vehiculo', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await page.setViewportSize({ width: 392, height: 850 });
  await page.addInitScript(() => window.localStorage.clear());
  await enterExpedition(page);

  const gameMap = page.getByTestId('game-map');
  const guidance = page.locator('.mission-route-arrow');
  await expect(gameMap).toHaveAttribute('data-mission-route-mode', 'road');
  await expect(gameMap).toHaveAttribute(
    'data-navigation-arrow-visible',
    'true',
  );
  await expect(guidance).toBeVisible();
  await page.getByRole('button', { name: 'Pausar partida' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Partida en pausa' }),
  ).toBeVisible();
  const positionBeforeRotation = await gameMap.evaluate(
    (element) =>
      `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
  );

  const viewportWidthBeforeRotation = Number(
    await gameMap.getAttribute('data-navigation-arrow-viewport-width'),
  );
  const viewportHeightBeforeRotation = Number(
    await gameMap.getAttribute('data-navigation-arrow-viewport-height'),
  );

  await page.setViewportSize({ width: 850, height: 392 });
  await expect
    .poll(() =>
      gameMap
        .getAttribute('data-navigation-arrow-viewport-width')
        .then(Number),
    )
    .not.toBe(viewportWidthBeforeRotation);
  await expect
    .poll(() =>
      gameMap
        .getAttribute('data-navigation-arrow-viewport-height')
        .then(Number),
    )
    .not.toBe(viewportHeightBeforeRotation);
  const landscapeGuidance = await gameMap.evaluate((element) => ({
    visible: element.dataset.navigationArrowVisible === 'true',
    screenX: Number(element.dataset.navigationArrowScreenX),
    screenY: Number(element.dataset.navigationArrowScreenY),
    viewportWidth: Number(element.dataset.navigationArrowViewportWidth),
    viewportHeight: Number(element.dataset.navigationArrowViewportHeight),
  }));
  const landscapeGuidanceFits =
    landscapeGuidance.screenX >= navigationGuidanceViewportMarginPixels &&
    landscapeGuidance.screenX <=
      landscapeGuidance.viewportWidth -
        navigationGuidanceViewportMarginPixels &&
    landscapeGuidance.screenY >= navigationGuidanceViewportMarginPixels &&
    landscapeGuidance.screenY <=
      landscapeGuidance.viewportHeight -
        navigationGuidanceViewportMarginPixels;
  expect(landscapeGuidance.visible).toBe(landscapeGuidanceFits);
  if (landscapeGuidanceFits) {
    await expect(guidance).toBeVisible();
  } else {
    await expect(guidance).toBeHidden();
  }
  await expect
    .poll(() =>
      gameMap.evaluate(
        (element) =>
          `${element.dataset.playerLongitude},${element.dataset.playerLatitude}`,
      ),
    )
    .toBe(positionBeforeRotation);

  await page.setViewportSize({ width: 392, height: 850 });
  await expect(gameMap).toHaveAttribute(
    'data-navigation-arrow-visible',
    'true',
  );
  await expect(guidance).toBeVisible();
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 392, height: 850 },
]) {
  test(`mantiene el vehículo fuera del tutorial arrastrable en ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile');
    await page.setViewportSize(viewport);
    await page.addInitScript(() => window.localStorage.clear());
    await enterMobileTutorial(page);

    const initial = await expectTutorialOutsidePlayer(page);
    const grip = page.locator('.mobile-tutorial-card__grip');
    const gripBox = await grip.boundingBox();
    expect(gripBox).not.toBeNull();
    await page.mouse.move(
      gripBox!.x + gripBox!.width / 2,
      gripBox!.y + gripBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(initial.playerX, initial.playerY, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.mobile-tutorial-card')).toHaveClass(
      /mobile-tutorial-card--moved/,
    );
    await expect(page.getByTestId('game-map')).toHaveAttribute(
      'data-player-outside-safe-viewport',
      'false',
    );
    await expect
      .poll(() => expectTutorialOutsidePlayer(page).then(() => true))
      .toBe(true);
  });
}

test('no actualiza continuamente el marcador fallback oculto', async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile');
  await page.addInitScript(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 8,
    });
    Object.defineProperty(navigator, 'deviceMemory', {
      configurable: true,
      value: 8,
    });
  });
  await enterExpedition(page);
  await selectMobileTarget(context, page, 50, 9);

  const mapFrame = page.locator('.map-frame');
  await expect(mapFrame).toHaveAttribute('data-player-renderer', 'ready', {
    timeout: 20_000,
  });
  await expect(page.locator('.player-marker')).toHaveClass(
    /player-marker--fallback-hidden/,
  );
  const gameMap = page.getByTestId('game-map');
  await expect(gameMap).toHaveAttribute(
    'data-safe-viewport-measurement-count',
    /^\d+$/,
  );
  // Deja terminar los overlays de descubrimiento/ayuda; después el layout es
  // estable y mover MapLibre no debe provocar nuevas lecturas del DOM.
  await page.waitForTimeout(3_500);
  const initialSafeViewportMeasurements = Number(
    await gameMap.getAttribute('data-safe-viewport-measurement-count'),
  );
  const initialSafeProjectionUpdates = Number(
    await gameMap.getAttribute('data-camera-safe-projection-updates'),
  );
  const initialAppliedCameraUpdates = Number(
    await gameMap.getAttribute('data-camera-applied-updates'),
  );
  const initialFallbackUpdates = Number(
    await gameMap.getAttribute('data-camera-fallback-marker-updates'),
  );
  const initialThreeUpdates = Number(
    await gameMap.getAttribute('data-camera-three-player-updates'),
  );
  const initialEffectsUpdates = Number(
    await gameMap.getAttribute('data-three-driving-effects-updates'),
  );

  await page.waitForTimeout(5_000);
  expect(
    Number(await gameMap.getAttribute('data-camera-fallback-marker-updates')),
  ).toBe(initialFallbackUpdates);
  expect(
    Number(await gameMap.getAttribute('data-camera-three-player-updates')),
  ).toBeGreaterThan(initialThreeUpdates);
  expect(
    Number(await gameMap.getAttribute('data-three-driving-effects-updates')),
  ).toBe(initialEffectsUpdates);
  const appliedCameraDelta =
    Number(await gameMap.getAttribute('data-camera-applied-updates')) -
    initialAppliedCameraUpdates;
  const safeMeasurementDelta =
    Number(await gameMap.getAttribute('data-safe-viewport-measurement-count')) -
    initialSafeViewportMeasurements;
  const safeProjectionDelta =
    Number(await gameMap.getAttribute('data-camera-safe-projection-updates')) -
    initialSafeProjectionUpdates;
  expect(appliedCameraDelta).toBeGreaterThan(50);
  expect(safeMeasurementDelta).toBeLessThanOrEqual(5);
  expect(safeProjectionDelta).toBeLessThanOrEqual(5);
  expect(safeMeasurementDelta).toBeLessThan(appliedCameraDelta * 0.1);
  expect(safeProjectionDelta).toBeLessThan(appliedCameraDelta * 0.1);
});

test('mantiene HUD compacto y cámara de escritorio al conducir', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  await page.addInitScript(() => window.localStorage.clear());
  await enterExpedition(page);
  await expect
    .poll(
      async () => {
        await page.keyboard.down('w');
        await page.keyboard.down('Shift');
        const speed = Number(
          await page.getByTestId('player-speed').textContent(),
        );
        const compact = await page
          .locator('.player-hud')
          .evaluate((element) =>
            element.classList.contains('player-hud--compact-driving'),
          );
        const camera = await page
          .getByTestId('game-map')
          .getAttribute('data-current-camera-profile');
        return (
          speed > 8 && compact && (camera === 'urban' || camera === 'fast')
        );
      },
      { timeout: 12_000 },
    )
    .toBe(true);
  await expect(page.getByTestId('mobile-driving-hud')).toBeHidden();
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
});

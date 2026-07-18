import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from '@playwright/test';
import { routingConfig } from '../../src/config/routing.config';

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
    width: box!.width,
  };
}

async function touchStart(
  session: CDPSession,
  id: number,
  x: number,
  y: number,
): Promise<void> {
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id, x, y, force: 1 }],
  });
}

async function touchMove(
  session: CDPSession,
  id: number,
  x: number,
  y: number,
): Promise<void> {
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id, x, y, force: 1 }],
  });
}

async function touchEnd(session: CDPSession): Promise<void> {
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

async function steerTowardRoute(
  page: Page,
  session: CDPSession,
  joystickCenter: Awaited<ReturnType<typeof centerOf>>,
  touchId: number,
  direction: 'toward' | 'away' = 'toward',
): Promise<void> {
  const gameMap = page.getByTestId('game-map');
  const headingDelta = async () => {
    const [recommended, physical] = await Promise.all([
      gameMap
        .getAttribute('data-navigation-recommended-heading')
        .then(Number),
      gameMap.getAttribute('data-navigation-physical-heading').then(Number),
    ]);
    const target =
      direction === 'away' ? (recommended + 180) % 360 : recommended;
    const shortest = ((target - physical + 540) % 360) - 180;
    // Near 180 degrees both directions are equivalent. Commit to the
    // right-hand turn so real touch gestures do not alternate around the tie.
    return Math.abs(shortest) >= 170 ? Math.abs(shortest) : shortest;
  };
  const initialDelta = await headingDelta();
  if (!Number.isFinite(initialDelta) || Math.abs(initialDelta) <= 4) {
    await page.waitForTimeout(180);
    return;
  }
  await touchStart(session, touchId, joystickCenter.x, joystickCenter.y);
  const steeringDeadline = Date.now() + 650;
  while (Date.now() < steeringDeadline) {
    const delta = await headingDelta();
    if (!Number.isFinite(delta) || Math.abs(delta) <= 6) break;
    await touchMove(
      session,
      touchId,
      joystickCenter.x +
        (delta >= 0 ? 1 : -1) * joystickCenter.width * 0.48,
      joystickCenter.y,
    );
    await page.waitForTimeout(60);
  }
  await touchEnd(session);
  await page.waitForTimeout(30);
}

test('completa cinco pasos y continúa con consejos móviles reales', async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(window.navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 4,
    });
    Object.defineProperty(window.navigator, 'deviceMemory', {
      configurable: true,
      value: 4,
    });
    const observeContextualAdvice = () => {
      const recordAdvice = () => {
        const advice = document.querySelector<HTMLElement>(
          '[data-contextual-advice="objective"]',
        );
        if (!advice) return;
        document.documentElement.dataset.testObjectiveAdviceObserved = 'true';
        document.documentElement.dataset.testObjectiveAdvicePointerEvents =
          getComputedStyle(advice).pointerEvents;
        const dismiss = advice.querySelector<HTMLElement>(
          'button[aria-label="Ocultar consejo"]',
        );
        if (dismiss) {
          document.documentElement.dataset.testObjectiveDismissPointerEvents =
            getComputedStyle(dismiss).pointerEvents;
        }
      };
      const observer = new MutationObserver(recordAdvice);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      recordAdvice();
    };
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', observeContextualAdvice, {
        once: true,
      });
    } else {
      observeContextualAdvice();
    }
  });
  await page.goto('/');
  const sessionStartedAt = Date.now();
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();

  const introduction = page.getByRole('dialog', {
    name: 'Una señal de auxilio',
  });
  await expect(introduction).toBeVisible();
  expect(Date.now() - sessionStartedAt).toBeLessThan(45_000);
  await expect(introduction).toContainText('JUEGO EN PAUSA');
  await expect(page.locator('[data-tutorial-card="mobile"]')).toHaveCount(0);
  await expect(page.getByTestId('mobile-driving-hud')).toHaveCount(0);

  await introduction
    .getByRole('button', { name: 'Comenzar investigación' })
    .click();
  const drivingStartedAt = Date.now();
  const tutorialStartedAt = Date.now();
  await expect(introduction).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'select-speed',
  );
  await expect(page.getByText('Paso 1 de 5')).toBeVisible();
  await expect(page.getByTestId('mobile-driving-hud')).toHaveCount(0);
  await expect(page.getByTestId('mobile-mini-navigator')).toHaveCount(0);
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-road-network-status',
    'ready',
    { timeout: 20_000 },
  );
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-mission-route-mode',
    'road',
    { timeout: 20_000 },
  );
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId('game-map')
          .getAttribute('data-mission-route-coordinate-count'),
      ),
    )
    .toBeGreaterThan(1);

  const joystick = page.getByLabel('Joystick de conducción arcade');
  let center = await centerOf(joystick);
  const session = await context.newCDPSession(page);

  await touchStart(session, 1, center.x, center.y);
  await touchMove(session, 1, center.x, center.y - center.width * 0.44);
  await expect
    .poll(() =>
      page
        .getByTestId('game-map')
        .getAttribute('data-input-target-speed')
        .then(Number),
    )
    .toBeGreaterThanOrEqual(25);
  await expect
    .poll(() =>
      page
        .getByTestId('game-map')
        .getAttribute('data-player-speed-kilometers-per-hour')
        .then(Number),
    )
    .toBeGreaterThan(5);
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'steer',
  );
  await touchEnd(session);

  const headingBeforeTurn = Number(
    await page
      .getByTestId('game-map')
      .getAttribute('data-navigation-physical-heading'),
  );
  await touchStart(session, 2, center.x, center.y);
  await touchMove(session, 2, center.x + center.width * 0.6, center.y);
  await expect
    .poll(() =>
      page.getByTestId('game-map').getAttribute('data-input-turn').then(Number),
    )
    .toBeGreaterThan(0.4);
  await expect
    .poll(async () => {
      const heading = Number(
        await page
          .getByTestId('game-map')
          .getAttribute('data-navigation-physical-heading'),
      );
      return Math.abs(((heading - headingBeforeTurn + 540) % 360) - 180);
    })
    .toBeGreaterThanOrEqual(4);
  expect(Date.now() - drivingStartedAt).toBeLessThan(15_000);
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'coast',
  );
  await touchEnd(session);
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'brake',
    { timeout: 12_000 },
  );

  await touchStart(session, 3, center.x, center.y);
  await touchMove(session, 3, center.x, center.y + center.width * 0.44);
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'route',
    { timeout: 10_000 },
  );
  await expect(page.getByText('Paso 5 de 5')).toBeVisible();
  await expect(page.getByTestId('mobile-driving-hud')).toHaveCount(0);
  await expect(page.getByTestId('mobile-mini-navigator')).toHaveCount(0);
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-input-cruise-reversing',
    'false',
  );
  await touchEnd(session);
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-input-cruise-reverse-state',
    'reverse-armed',
  );
  center = await centerOf(joystick);

  const interaction = page.getByRole('button', { name: 'Escuchar señal' });
  let steeringTouchId = 10;

  await touchStart(session, 4, center.x, center.y);
  await touchMove(session, 4, center.x, center.y - center.width * 0.24);
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-input-cruise-reverse-state',
    'forward',
  );
  await expect
    .poll(() =>
      page
        .getByTestId('game-map')
        .getAttribute('data-input-target-speed')
        .then(Number),
    )
    .toBeGreaterThanOrEqual(15);
  await touchEnd(session);
  await expect
    .poll(() =>
      page
        .getByTestId('game-map')
        .getAttribute('data-player-speed-kilometers-per-hour')
        .then(Number),
    )
    .toBeGreaterThan(5);

  const gameMap = page.getByTestId('game-map');
  const tutorialCard = page.locator('[data-tutorial-card="mobile"]');
  const routeNeedsCorrection = async () => {
    const [offRoute, requiresRejoin, surface, distance, recommended, physical] =
      await Promise.all([
        gameMap.getAttribute('data-navigation-off-route'),
        gameMap.getAttribute('data-navigation-requires-rejoin'),
        gameMap.getAttribute('data-road-contact-surface'),
        gameMap.getAttribute('data-navigation-distance-to-route').then(Number),
        gameMap
          .getAttribute('data-navigation-recommended-heading')
          .then(Number),
        gameMap.getAttribute('data-navigation-physical-heading').then(Number),
      ]);
    const headingDifference = Math.abs(
      ((recommended - physical + 540) % 360) - 180,
    );
    return (
      offRoute === 'true' ||
      requiresRejoin === 'true' ||
      surface === 'offroad' ||
      !Number.isFinite(distance) ||
      distance > routingConfig.routeRejoinDistanceMeters ||
      !Number.isFinite(headingDifference) ||
      headingDifference > routingConfig.tutorialRouteHeadingToleranceDegrees
    );
  };
  const routeFollowDeadline = Date.now() + 20_000;
  while ((await tutorialCard.count()) > 0 && Date.now() < routeFollowDeadline) {
    if (await routeNeedsCorrection()) {
      steeringTouchId += 1;
      await steerTowardRoute(page, session, center, steeringTouchId);
    } else {
      // Keep the real cruise active while the product holds a valid route for
      // ROUTE_FOLLOW_HOLD_MILLISECONDS before completing the tutorial.
      await page.waitForTimeout(120);
    }
  }
  await expect(gameMap).toHaveAttribute('data-navigation-off-route', 'false');
  await expect(gameMap).toHaveAttribute(
    'data-navigation-requires-rejoin',
    'false',
  );
  await expect(tutorialCard).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-tutorial-target',
    /.+/,
  );
  // A constrained headless runner needs additional real gestures to hold the
  // routed heading for 900 ms. Keep a bounded budget without treating runner
  // throughput as a gameplay failure.
  expect(Date.now() - tutorialStartedAt).toBeLessThan(60_000);
  await expect(page.getByTestId('mobile-driving-hud')).toBeVisible();
  await expect(gameMap).toHaveAttribute(
    'data-current-mission-objective-id',
    'sintonizar-transmision',
  );
  center = await centerOf(joystick);

  steeringTouchId += 1;
  await touchStart(session, steeringTouchId, center.x, center.y);
  await touchMove(
    session,
    steeringTouchId,
    center.x,
    center.y - center.width * 0.85,
  );
  await expect
    .poll(() => gameMap.getAttribute('data-input-target-speed').then(Number))
    .toBeGreaterThan(50);
  await touchEnd(session);

  steeringTouchId += 1;
  await touchStart(session, steeringTouchId, center.x, center.y);
  await touchMove(
    session,
    steeringTouchId,
    center.x,
    center.y + center.width * 0.44,
  );
  await expect(gameMap).toHaveAttribute(
    'data-input-cruise-reverse-state',
    'braking-to-stop',
  );
  await touchEnd(session);
  await expect
    .poll(() =>
      gameMap
        .getAttribute('data-player-speed-kilometers-per-hour')
        .then(Number),
    )
    .toBeLessThan(1);
  await expect(gameMap).toHaveAttribute(
    'data-input-cruise-reverse-state',
    'reverse-armed',
  );
  steeringTouchId += 1;
  await touchStart(session, steeringTouchId, center.x, center.y);
  await touchMove(
    session,
    steeringTouchId,
    center.x,
    center.y - center.width * 0.24,
  );
  await expect
    .poll(() => gameMap.getAttribute('data-input-target-speed').then(Number))
    .toBeGreaterThanOrEqual(25);
  await touchEnd(session);

  const documentElement = page.locator('html');
  const objectiveAdviceWasObserved = () =>
    documentElement
      .getAttribute('data-test-objective-advice-observed')
      .then((value) => value === 'true');
  const objectiveObservationDeadline = Date.now() + 30_000;
  let objectiveObservationReady = false;
  while (
    !(await objectiveAdviceWasObserved()) &&
    Date.now() < objectiveObservationDeadline
  ) {
    const interactionVisible = await interaction.isVisible();
    const markerVisible =
      (await gameMap.getAttribute('data-current-mission-objective-visible')) ===
      'true';
    if (!interactionVisible && markerVisible) {
      objectiveObservationReady = true;
      break;
    }
    steeringTouchId += 1;
    await steerTowardRoute(
      page,
      session,
      center,
      steeringTouchId,
      interactionVisible ? 'away' : 'toward',
    );
  }
  let stoppedForObjectiveObservation = false;
  if (!(await objectiveAdviceWasObserved())) {
    expect(objectiveObservationReady).toBe(true);
    steeringTouchId += 1;
    await touchStart(session, steeringTouchId, center.x, center.y);
    await touchMove(
      session,
      steeringTouchId,
      center.x,
      center.y + center.width * 0.44,
    );
    await expect(gameMap).toHaveAttribute(
      'data-input-cruise-reverse-state',
      'braking-to-stop',
    );
    await touchEnd(session);
    await expect
      .poll(() =>
        gameMap
          .getAttribute('data-player-speed-kilometers-per-hour')
          .then(Number),
      )
      .toBeLessThan(1);
    await expect(gameMap).toHaveAttribute(
      'data-input-cruise-reverse-state',
      'reverse-armed',
    );
    stoppedForObjectiveObservation = true;
  }
  await expect(documentElement).toHaveAttribute(
    'data-test-objective-advice-observed',
    'true',
    { timeout: 8_000 },
  );
  await expect(documentElement).toHaveAttribute(
    'data-test-objective-advice-pointer-events',
    'none',
  );
  await expect(documentElement).toHaveAttribute(
    'data-test-objective-dismiss-pointer-events',
    'auto',
  );

  if (stoppedForObjectiveObservation) {
    steeringTouchId += 1;
    await touchStart(session, steeringTouchId, center.x, center.y);
    await touchMove(
      session,
      steeringTouchId,
      center.x,
      center.y - center.width * 0.24,
    );
    await expect(gameMap).toHaveAttribute(
      'data-input-cruise-reverse-state',
      'forward',
    );
    await expect
      .poll(() => gameMap.getAttribute('data-input-target-speed').then(Number))
      .toBeGreaterThanOrEqual(25);
    await touchEnd(session);
  }

  const interactionDeadline = Date.now() + 35_000;
  while (!(await interaction.isVisible()) && Date.now() < interactionDeadline) {
    steeringTouchId += 1;
    await steerTowardRoute(page, session, center, steeringTouchId);
  }
  await expect(interaction).toBeVisible();
  await expect(interaction).toBeEnabled();
  await expect(
    page.locator('[data-contextual-advice="interaction"]'),
  ).toBeVisible();
  await interaction.click();

  await expect(
    page.locator('.radio-message:not(.radio-message--compact)'),
  ).toBeVisible();
  await expect(
    page.getByText('Registro de frecuencia guardado', { exact: true }),
  ).toBeVisible();
  expect(Date.now() - sessionStartedAt).toBeLessThan(90_000);
  const compactRadio = page.getByRole('button', {
    name: 'Expandir transmisión de radio',
  });
  await expect(compactRadio).toBeVisible({ timeout: 7_000 });
  await compactRadio.click();
  await expect(page.getByText('La señal continúa al oeste')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar transmisión' }).click();

  await expect(page.locator('.map-fuel-legend')).toHaveAttribute(
    'data-fuel-presentation',
    'icon',
  );
  await expect(
    page.locator('.fuel-station-marker[data-fuel-presentation="icon"]').first(),
  ).toBeVisible();

  const boostAdvice = page.locator('[data-contextual-advice="boost"]');
  await expect(boostAdvice).toBeVisible({ timeout: 12_000 });
  const turbo = page.getByRole('button', { name: 'Turbo' });
  await expect(turbo).toBeEnabled();
  await turbo.click();
  await expect(boostAdvice).toHaveCount(0);

  const journalAdvice = page.locator('[data-contextual-advice="journal"]');
  await expect(journalAdvice).toBeVisible({ timeout: 8_000 });
  await journalAdvice.getByRole('button', { name: 'Abrir bitácora' }).click();
  await expect(
    page.getByRole('button', { name: 'Cerrar bitácora' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar bitácora' }).click();

  await expect(page.locator('[data-tutorial-card="mobile"]')).toHaveCount(0);
  await expect(page.getByTestId('mobile-driving-hud')).toBeVisible();
  await session.detach();
});

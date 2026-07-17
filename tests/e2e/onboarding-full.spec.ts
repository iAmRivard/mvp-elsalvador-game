import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from '@playwright/test';

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
  const recommended = Number(
    await gameMap.getAttribute('data-navigation-recommended-heading'),
  );
  const physical = Number(
    await gameMap.getAttribute('data-navigation-physical-heading'),
  );
  const target = direction === 'away' ? (recommended + 180) % 360 : recommended;
  const headingDelta = ((target - physical + 540) % 360) - 180;
  if (!Number.isFinite(headingDelta) || Math.abs(headingDelta) <= 4) {
    await page.waitForTimeout(180);
    return;
  }
  await touchStart(session, touchId, joystickCenter.x, joystickCenter.y);
  await touchMove(
    session,
    touchId,
    joystickCenter.x +
      (headingDelta >= 0 ? 1 : -1) * joystickCenter.width * 0.48,
    joystickCenter.y,
  );
  await page.waitForTimeout(220);
  await touchEnd(session);
  await page.waitForTimeout(70);
}

test('completa cinco pasos y continúa con consejos móviles reales', async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
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
  await touchMove(session, 4, center.x, center.y - center.width * 0.44);
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-input-cruise-reverse-state',
    'forward',
  );
  await touchEnd(session);
  await touchStart(session, 5, center.x, center.y);
  await touchMove(session, 5, center.x, center.y - center.width * 0.44);
  await expect
    .poll(() =>
      page
        .getByTestId('game-map')
        .getAttribute('data-input-target-speed')
        .then(Number),
    )
    .toBeGreaterThan(20);
  await expect
    .poll(() =>
      page
        .getByTestId('game-map')
        .getAttribute('data-player-speed-kilometers-per-hour')
        .then(Number),
    )
    .toBeGreaterThan(5);
  await touchEnd(session);

  const gameMap = page.getByTestId('game-map');
  const rejoinDeadline = Date.now() + 18_000;
  while (
    (await gameMap.getAttribute('data-navigation-requires-rejoin')) ===
      'true' &&
    Date.now() < rejoinDeadline
  ) {
    steeringTouchId += 1;
    await steerTowardRoute(page, session, center, steeringTouchId);
  }
  await expect(gameMap).toHaveAttribute('data-navigation-off-route', 'false');
  await expect(gameMap).toHaveAttribute(
    'data-navigation-requires-rejoin',
    'false',
  );
  await expect(page.locator('[data-tutorial-card="mobile"]')).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-tutorial-target',
    /.+/,
  );
  expect(Date.now() - tutorialStartedAt).toBeLessThan(30_000);
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

  const objectiveAdvice = page.locator('[data-contextual-advice="objective"]');
  let objectiveAdviceObserved = false;
  const objectiveAdviceChecks = Promise.all([
    expect(objectiveAdvice).toBeVisible({ timeout: 50_000 }),
    expect(objectiveAdvice).toContainText('Objetivo a la vista', {
      timeout: 50_000,
    }),
    expect(objectiveAdvice).toHaveCSS('pointer-events', 'none', {
      timeout: 50_000,
    }),
    expect(
      objectiveAdvice.getByRole('button', { name: 'Ocultar consejo' }),
    ).toHaveCSS('pointer-events', 'auto', { timeout: 50_000 }),
  ]).then(() => {
    objectiveAdviceObserved = true;
  });

  await page.waitForTimeout(400);
  const retreatDeadline = Date.now() + 20_000;
  while (
    !objectiveAdviceObserved &&
    (await interaction.isVisible()) &&
    Date.now() < retreatDeadline
  ) {
    steeringTouchId += 1;
    await steerTowardRoute(page, session, center, steeringTouchId, 'away');
  }
  const objectiveDeadline = Date.now() + 30_000;
  while (!objectiveAdviceObserved && Date.now() < objectiveDeadline) {
    steeringTouchId += 1;
    await steerTowardRoute(page, session, center, steeringTouchId);
  }
  await objectiveAdviceChecks;

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

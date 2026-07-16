import { expect, test, type CDPSession, type Locator } from '@playwright/test';

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

test('completa el onboarding móvil 392×850 con acciones reales', async ({
  context,
  page,
}) => {
  test.setTimeout(100_000);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Comenzar expedición' }).click();

  const introduction = page.getByRole('dialog', {
    name: 'Una señal de auxilio',
  });
  await expect(introduction).toBeVisible();
  await expect(introduction).toContainText('JUEGO EN PAUSA');
  await expect(page.locator('[data-tutorial-card="mobile"]')).toHaveCount(0);
  await expect(
    page.getByRole('complementary', { name: 'Panel de misiones' }),
  ).toHaveCount(0);
  await expect(page.getByTestId('mobile-mission-cta')).toHaveCount(0);

  await introduction
    .getByRole('button', { name: 'Comenzar investigación' })
    .click();
  await expect(introduction).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'steer',
  );
  await expect(page.getByTestId('mobile-mission-cta')).toHaveCount(0);
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-road-network-status',
    'ready',
    { timeout: 20_000 },
  );

  const joystick = page.getByLabel('Joystick de velocidad objetivo');
  let center = await centerOf(joystick);
  const session = await context.newCDPSession(page);

  await touchStart(session, 1, center.x, center.y);
  await touchMove(
    session,
    1,
    center.x + center.width * 0.6,
    center.y,
  );
  await expect
    .poll(() =>
      page
        .getByTestId('game-map')
        .getAttribute('data-input-turn')
        .then(Number),
    )
    .toBeGreaterThan(0.4);
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'select-speed',
  );
  await touchEnd(session);

  await touchStart(session, 2, center.x, center.y);
  await touchMove(
    session,
    2,
    center.x,
    center.y - center.width * 0.44,
  );
  await expect
    .poll(() =>
      page
        .getByTestId('game-map')
        .getAttribute('data-input-target-speed')
        .then(Number),
    )
    .toBeGreaterThan(20);
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
  await touchMove(
    session,
    3,
    center.x,
    center.y + center.width * 0.44,
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'route',
    { timeout: 10_000 },
  );
  await expect(page.getByTestId('mobile-mini-navigator')).toBeVisible();
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

  await touchStart(session, 4, center.x, center.y);
  await touchMove(
    session,
    4,
    center.x,
    center.y - center.width * 0.44,
  );
  await expect(page.getByTestId('game-map')).toHaveAttribute(
    'data-input-cruise-reverse-state',
    'forward',
  );
  await touchEnd(session);
  await touchStart(session, 5, center.x, center.y);
  await touchMove(
    session,
    5,
    center.x,
    center.y - center.width * 0.44,
  );
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
  let steeringTouchId = 10;
  const rejoinDeadline = Date.now() + 18_000;
  while (
    (await gameMap.getAttribute('data-navigation-requires-rejoin')) ===
      'true' &&
    Date.now() < rejoinDeadline
  ) {
    const recommended = Number(
      await gameMap.getAttribute('data-navigation-recommended-heading'),
    );
    const physical = Number(
      await gameMap.getAttribute('data-navigation-physical-heading'),
    );
    const headingDelta = ((recommended - physical + 540) % 360) - 180;
    const direction = headingDelta >= 0 ? 1 : -1;
    steeringTouchId += 1;
    await touchStart(session, steeringTouchId, center.x, center.y);
    await touchMove(
      session,
      steeringTouchId,
      center.x + direction * center.width * 0.55,
      center.y,
    );
    await page.waitForTimeout(260);
    await touchEnd(session);
    await page.waitForTimeout(80);
  }
  await expect(gameMap).toHaveAttribute('data-navigation-off-route', 'false');
  await expect(gameMap).toHaveAttribute(
    'data-navigation-requires-rejoin',
    'false',
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'objective',
    { timeout: 15_000 },
  );
  await expect(gameMap).toHaveAttribute(
    'data-current-mission-objective-id',
    'sintonizar-transmision',
  );
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
  const recognitionDeadline = Date.now() + 50_000;
  while (
    (await page.locator('html').getAttribute('data-tutorial-target')) ===
      'objective' &&
    Date.now() < recognitionDeadline
  ) {
    const recommended = Number(
      await gameMap.getAttribute('data-navigation-recommended-heading'),
    );
    const physical = Number(
      await gameMap.getAttribute('data-navigation-physical-heading'),
    );
    const headingDelta = ((recommended - physical + 540) % 360) - 180;
    if (Number.isFinite(headingDelta) && Math.abs(headingDelta) > 5) {
      steeringTouchId += 1;
      await touchStart(session, steeringTouchId, center.x, center.y);
      await touchMove(
        session,
        steeringTouchId,
        center.x + (headingDelta >= 0 ? 1 : -1) * center.width * 0.45,
        center.y,
      );
      await page.waitForTimeout(220);
      await touchEnd(session);
    } else {
      await page.waitForTimeout(250);
    }
  }
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'interact',
    { timeout: 8_000 },
  );

  const interaction = page.getByRole('button', { name: 'Escuchar señal' });
  await expect(interaction).toBeVisible();
  await expect(interaction).toBeEnabled();
  await interaction.click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'boost',
  );

  const turbo = page.getByRole('button', { name: 'Turbo' });
  const fatalMapAlert = page.getByRole('alert');
  await expect
    .poll(async () => {
      if (await fatalMapAlert.isVisible()) {
        return `map-error:${await fatalMapAlert.locator('code').textContent()}`;
      }
      return (await turbo.isEnabled()) ? 'ready' : 'waiting';
    })
    .toBe('ready');
  await turbo.click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-tutorial-target',
    'journal',
  );
  await page.getByRole('button', { name: 'Bitácora' }).click();
  await expect(page.locator('[data-tutorial-card="mobile"]')).toHaveCount(0, {
    timeout: 5_000,
  });
  await page.getByRole('button', { name: 'Cerrar bitácora' }).click();
  const closeRadio = page.getByRole('button', { name: 'Cerrar transmisión' });
  if (await closeRadio.isVisible()) await closeRadio.click();

  await expect(page.locator('html')).not.toHaveAttribute(
    'data-tutorial-target',
    /.+/,
  );
  await expect(page.getByTestId('mobile-driving-hud')).toBeVisible();
  await session.detach();
});

import { describe, expect, it } from 'vitest';
import {
  followCameraOffsetForSafeViewport,
  safeGameplayViewportFor,
  type GameplayRect,
} from '../src/game/safeGameplayViewport';

const canvas = (width: number, height: number): GameplayRect => ({
  x: 0,
  y: 0,
  width,
  height,
});

describe('viewport jugable seguro', () => {
  it('usa el viewport visual del navegador y no sacrifica franjas por controles laterales', () => {
    const safe = safeGameplayViewportFor({
      canvas: canvas(392, 850),
      visibleViewport: { x: 0, y: 64, width: 392, height: 786 },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      playerFootprint: { width: 44, height: 52 },
      paddingPixels: 10,
      occlusions: [
        {
          id: 'hud',
          kind: 'hud',
          rect: { x: 12, y: 52, width: 368, height: 68 },
        },
        {
          id: 'joystick',
          kind: 'joystick',
          rect: { x: 18, y: 680, width: 144, height: 144 },
        },
        {
          id: 'actions',
          kind: 'actions',
          rect: { x: 320, y: 670, width: 54, height: 154 },
        },
      ],
    });

    expect(safe).toMatchObject({ x: 10, y: 130, width: 372, height: 710 });
    expect(safe.usefulMapAreaRatio).toBeGreaterThanOrEqual(0.65);
    expect(safe.obstructed).toBe(false);
    expect(followCameraOffsetForSafeViewport(canvas(392, 850), safe, 0.6)).toEqual(
      [0, 131],
    );
  });

  it('distingue navegador y PWA mediante el área realmente visible', () => {
    const shared = {
      canvas: canvas(392, 850),
      safeAreaInsets: { top: 8, right: 0, bottom: 12, left: 0 },
      playerFootprint: { width: 44, height: 52 },
      occlusions: [] as const,
    };
    const browser = safeGameplayViewportFor({
      ...shared,
      visibleViewport: { x: 0, y: 58, width: 392, height: 742 },
    });
    const pwa = safeGameplayViewportFor({
      ...shared,
      visibleViewport: canvas(392, 850),
    });

    expect(browser.y).toBeGreaterThan(pwa.y);
    expect(browser.height).toBeLessThan(pwa.height);
    expect(
      followCameraOffsetForSafeViewport(shared.canvas, browser, 0.62)[1],
    ).not.toBe(
      followCameraOffsetForSafeViewport(shared.canvas, pwa, 0.62)[1],
    );
  });

  it.each([
    [360, 800],
    [412, 915],
    [850, 392],
  ])('mantiene un ancla 55–65%% en %d×%d', (width, height) => {
    const hudHeight = height < 560 ? 54 : 68;
    const safe = safeGameplayViewportFor({
      canvas: canvas(width, height),
      visibleViewport: canvas(width, height),
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      playerFootprint: { width: 44, height: 52 },
      occlusions: [
        {
          id: 'hud',
          kind: 'hud',
          rect: { x: 8, y: 44, width: width - 16, height: hudHeight },
        },
        {
          id: 'joystick',
          kind: 'joystick',
          rect: {
            x: 8,
            y: height - 176,
            width: width <= 360 ? 176 : 150,
            height: 160,
          },
        },
      ],
    });
    const offset = followCameraOffsetForSafeViewport(
      canvas(width, height),
      safe,
      0.62,
    );
    const playerY = height / 2 + offset[1];
    const ratio = (playerY - safe.y) / safe.height;

    expect(ratio).toBeGreaterThanOrEqual(0.55);
    expect(ratio).toBeLessThanOrEqual(0.65);
  });

  it('recorta debajo de un joystick grande cuando invade el corredor central', () => {
    const safe = safeGameplayViewportFor({
      canvas: canvas(360, 800),
      visibleViewport: canvas(360, 800),
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      playerFootprint: { width: 52, height: 58 },
      paddingPixels: 10,
      occlusions: [
        {
          id: 'large-joystick',
          kind: 'joystick',
          rect: { x: 8, y: 610, width: 190, height: 180 },
        },
      ],
    });

    expect(safe.y + safe.height).toBeLessThanOrEqual(600);
  });

  it('conserva el lado más amplio cuando un overlay arrastrable cruza el centro', () => {
    const safe = safeGameplayViewportFor({
      canvas: canvas(392, 850),
      visibleViewport: canvas(392, 850),
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      playerFootprint: { width: 48, height: 60 },
      paddingPixels: 10,
      occlusions: [
        {
          id: 'topbar',
          kind: 'hud',
          rect: { x: 0, y: 0, width: 392, height: 61 },
        },
        {
          id: 'bottom-controls',
          kind: 'actions',
          rect: { x: 0, y: 540, width: 392, height: 310 },
        },
        {
          id: 'dragged-tutorial',
          kind: 'overlay',
          rect: { x: 9, y: 338, width: 371, height: 127 },
        },
      ],
    });

    expect(safe).toMatchObject({ y: 71, height: 257, obstructed: false });
  });

  it('marca un overlay central que deja un área imposible', () => {
    const safe = safeGameplayViewportFor({
      canvas: canvas(392, 850),
      visibleViewport: canvas(392, 850),
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      playerFootprint: { width: 44, height: 52 },
      occlusions: [
        {
          id: 'overlay',
          kind: 'overlay',
          rect: { x: 0, y: 120, width: 392, height: 650 },
        },
      ],
    });

    expect(safe.obstructed).toBe(true);
  });
});

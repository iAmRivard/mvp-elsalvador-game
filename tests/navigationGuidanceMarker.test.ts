// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  createNavigationGuidanceElement,
  navigationGuidanceMinimumCenterDistancePixels,
  navigationGuidanceOffsetForPlayerSeparation,
} from '../src/map/navigationGuidanceMarker';
import { createPlayerMarkerElement } from '../src/map/playerMarker';

describe('claridad del vehículo y la navegación', () => {
  it('usa contratos visuales y accesibles diferentes', () => {
    const vehicle = createPlayerMarkerElement();
    const guidance = createNavigationGuidanceElement();

    expect(vehicle.classList.contains('player-marker')).toBe(true);
    expect(guidance.classList.contains('navigation-guidance-arrow')).toBe(true);
    expect(guidance.classList.contains('player-marker')).toBe(false);
    expect(vehicle.getAttribute('aria-label')).toBe('Vehículo del jugador');
    expect(guidance.getAttribute('aria-label')).toBe(
      'Chevrons de dirección de la ruta',
    );
    expect(
      guidance.querySelectorAll('.navigation-guidance-arrow__chevron'),
    ).toHaveLength(3);
    expect(guidance.textContent).toBe('›››');
    expect(guidance.textContent).not.toMatch(/[▲△⌃]/u);
  });

  it('separa la guía del vehículo cuando el lookahead se comprime en pantalla', () => {
    const player = { x: 206, y: 413 };
    const guidance = { x: 239, y: 392 };
    const offset = navigationGuidanceOffsetForPlayerSeparation(
      player,
      guidance,
    );
    const adjustedDistance = Math.hypot(
      guidance.x + offset[0] - player.x,
      guidance.y + offset[1] - player.y,
    );

    expect(adjustedDistance).toBeCloseTo(
      navigationGuidanceMinimumCenterDistancePixels,
    );
  });

  it('no desplaza una guía que ya está separada', () => {
    expect(
      navigationGuidanceOffsetForPlayerSeparation(
        { x: 100, y: 100 },
        { x: 180, y: 100 },
      ),
    ).toEqual([0, 0]);
  });
});

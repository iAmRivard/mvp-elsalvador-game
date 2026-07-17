// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createNavigationGuidanceElement } from '../src/map/navigationGuidanceMarker';
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
});

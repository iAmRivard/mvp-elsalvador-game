// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { vehicleSkinFor } from '../src/data/vehicles';
import {
  applyPlayerMarkerSkin,
  createPlayerMarkerElement,
} from '../src/map/playerMarker';

describe('skin del vehículo visible', () => {
  it('aplica el skin al fallback 2D y conserva su identidad accesible', () => {
    const initial = vehicleSkinFor('torogoz', 'torogoz-cyan');
    const marker = createPlayerMarkerElement(initial);

    expect(marker.className).toBe('player-marker');
    expect(marker.getAttribute('aria-label')).toBe('Vehículo del jugador');
    expect(marker.style.getPropertyValue('--player-vehicle-body')).toBe(
      '#11d9f2',
    );
  });

  it('cambia de skin sin recrear el marcador', () => {
    const marker = createPlayerMarkerElement(
      vehicleSkinFor('torogoz', 'torogoz-cyan'),
    );
    const identity = marker;
    applyPlayerMarkerSkin(
      marker,
      vehicleSkinFor('volcan-gt', 'volcan-obsidian'),
    );

    expect(marker).toBe(identity);
    expect(marker.style.getPropertyValue('--player-vehicle-body')).toBe(
      '#34313c',
    );
    expect(marker.style.getPropertyValue('--player-vehicle-accent')).toBe(
      '#ff7d52',
    );
  });
});

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  safeViewportOccluderObserverOptions,
  safeViewportMutationRootFor,
  safeViewportTreeObserverOptions,
} from '../src/game/safeViewportObservers';

describe('observadores del viewport jugable seguro', () => {
  it('no observa atributos de todo el Ã¡rbol del mapa', () => {
    expect(safeViewportTreeObserverOptions).toEqual({
      childList: true,
      subtree: true,
    });
    expect('attributes' in safeViewportTreeObserverOptions).toBe(false);
    expect('attributeFilter' in safeViewportTreeObserverOptions).toBe(false);
  });

  it('limita class y style a los oclusores conocidos', () => {
    expect(safeViewportOccluderObserverOptions).toEqual({
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    expect('subtree' in safeViewportOccluderObserverOptions).toBe(false);
  });

  it('incluye oclusores dinÃ¡micos que viven fuera de map-stage', () => {
    document.body.innerHTML = `
      <main class="game-shell">
        <section class="map-stage"><div data-testid="game-map"></div></section>
        <div class="service-worker-update"></div>
      </main>
    `;
    const gameMap = document.querySelector('[data-testid="game-map"]');
    const updatePrompt = document.querySelector('.service-worker-update');

    expect(gameMap).not.toBeNull();
    expect(updatePrompt).not.toBeNull();
    expect(safeViewportMutationRootFor(gameMap!)).toBe(
      document.querySelector('.game-shell'),
    );
    expect(safeViewportMutationRootFor(gameMap!).contains(updatePrompt)).toBe(
      true,
    );
  });
});

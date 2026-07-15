// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StartScreen } from '../src/components/menu/StartScreen';
import { useGameStore } from '../src/store/gameStore';

vi.mock('../src/roads/roadNetwork', () => ({
  loadRoadNetwork: vi.fn(() => new Promise(() => undefined)),
  retryRoadNetworkLoad: vi.fn(() => new Promise(() => undefined)),
}));
vi.mock('../src/roads/roadWorkerClient', () => ({
  preloadRoadWorker: vi.fn(() => Promise.resolve(null)),
}));

describe('inicio opcional en pantalla completa', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  afterEach(() => cleanup());

  it('inicia la expedición desde el mismo gesto de fullscreen', () => {
    const onContinueFullscreen = vi.fn();
    render(
      <StartScreen
        onContinue={vi.fn()}
        onContinueFullscreen={onContinueFullscreen}
        onNewGame={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Comenzar en pantalla completa' }),
    );
    expect(onContinueFullscreen).toHaveBeenCalledOnce();
  });

  it('oculta la sugerencia cuando ya corre como aplicación instalada', () => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === '(display-mode: standalone)',
    }) as MediaQueryList);
    render(
      <StartScreen
        onContinue={vi.fn()}
        onContinueFullscreen={vi.fn()}
        onNewGame={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Comenzar en pantalla completa' }),
    ).toBeNull();
  });
});

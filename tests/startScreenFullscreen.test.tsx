// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  START_PREPARATION_DEADLINE_MILLISECONDS,
  StartScreen,
} from '../src/components/menu/StartScreen';
import { loadRoadNetwork } from '../src/roads/roadNetwork';
import { probeMapSourceAvailability } from '../src/game/mapSourceAvailability';
import { useGameStore } from '../src/store/gameStore';

vi.mock('../src/roads/roadNetwork', () => ({
  loadRoadNetwork: vi.fn(() => Promise.resolve(undefined)),
  retryRoadNetworkLoad: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock('../src/roads/roadWorkerClient', () => ({
  preloadRoadWorker: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../src/components/map/GameMap', () => ({
  GameMap: () => null,
}));
vi.mock('../src/game/mapSourceAvailability', () => ({
  probeMapSourceAvailability: vi.fn(() => Promise.resolve(true)),
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
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    vi.mocked(probeMapSourceAvailability).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('muestra la version y el SHA del build', () => {
    render(
      <StartScreen
        onContinue={vi.fn()}
        onContinueFullscreen={vi.fn()}
        onNewGame={vi.fn()}
      />,
    );

    const identity = screen.getByTestId('build-identity');
    expect(identity.textContent).toMatch(/^v0\.3\.1 · /);
    expect(identity.getAttribute('data-build-sha')).toMatch(
      /^(?:local|[0-9a-f]{7,40})$/,
    );
  });

  it('inicia la expedición desde el mismo gesto de fullscreen al estar listo', async () => {
    const onContinueFullscreen = vi.fn();
    render(
      <StartScreen
        onContinue={vi.fn()}
        onContinueFullscreen={onContinueFullscreen}
        onNewGame={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', {
      name: 'Comenzar en pantalla completa',
    });
    expect(button).toHaveProperty('disabled', true);
    await waitFor(() => expect(button).toHaveProperty('disabled', false));
    fireEvent.click(button);
    expect(onContinueFullscreen).toHaveBeenCalledOnce();
  });

  it('oculta la sugerencia cuando ya corre como aplicación instalada', () => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query) =>
        ({
          matches: query === '(display-mode: standalone)',
        }) as MediaQueryList,
    );
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

  it('usa la disponibilidad real del mapa y protege la nueva partida', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    const onNewGame = vi.fn();
    useGameStore.setState({
      hasSavedGame: true,
      lastSavedAt: '2026-07-17T12:00:00.000Z',
    });
    render(
      <StartScreen
        onContinue={vi.fn()}
        onContinueFullscreen={vi.fn()}
        onNewGame={onNewGame}
      />,
    );

    const continueButton = screen.getByRole('button', {
      name: 'Continuar expedición',
    });
    const newGameButton = screen.getByRole('button', {
      name: 'Nueva partida',
    });
    await waitFor(() =>
      expect(continueButton).toHaveProperty('disabled', false),
    );
    expect(newGameButton).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Garaje' })).toHaveProperty(
      'disabled',
      false,
    );
    fireEvent.click(newGameButton);
    const confirmation = screen.getByRole('alertdialog', {
      name: '¿Comenzar una nueva expedición?',
    });
    const confirmNewGame = within(confirmation).getByRole('button', {
      name: 'Nueva partida',
    });
    expect(confirmNewGame).toHaveProperty('disabled', false);

    vi.mocked(probeMapSourceAvailability).mockResolvedValue(false);
    fireEvent.click(confirmNewGame);

    await waitFor(() =>
      expect(
        within(confirmation).getByText(
          'El mapa no está disponible. Tu partida guardada no se modificó.',
        ),
      ).toBeTruthy(),
    );
    expect(continueButton).toHaveProperty('disabled', true);
    expect(newGameButton).toHaveProperty('disabled', true);
    expect(confirmNewGame).toHaveProperty('disabled', true);
    expect(
      screen.getByText(
        'Inicio, red vial y progreso disponibles. El mapa no está accesible; reintenta cuando vuelva la conexión con este servidor.',
      ),
    ).toBeTruthy();
    expect(onNewGame).not.toHaveBeenCalled();

    vi.mocked(probeMapSourceAvailability).mockResolvedValue(true);
    await act(() => {
      window.dispatchEvent(new Event('online'));
      return Promise.resolve();
    });
    await waitFor(() =>
      expect(confirmNewGame).toHaveProperty('disabled', false),
    );
  });

  it('habilita un fallback recuperable si la preparación no responde', async () => {
    vi.useFakeTimers();
    vi.mocked(loadRoadNetwork).mockReturnValueOnce(
      new Promise(() => undefined),
    );
    render(
      <StartScreen
        onContinue={vi.fn()}
        onContinueFullscreen={vi.fn()}
        onNewGame={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const button = screen.getByRole('button', {
      name: 'Comenzar expedición',
    });
    expect(button).toHaveProperty('disabled', true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        START_PREPARATION_DEADLINE_MILLISECONDS,
      );
    });
    expect(button).toHaveProperty('disabled', false);
    expect(
      screen.getByText(/modo compatible sin asistencia vial completa/i),
    ).toBeTruthy();
  });
});

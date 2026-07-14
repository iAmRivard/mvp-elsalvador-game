// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorialOverlay } from '../src/components/menu/TutorialOverlay';
import { InputController } from '../src/game/inputController';
import { useGameStore } from '../src/store/gameStore';
import { useSettingsStore } from '../src/store/settingsStore';

function setCoarsePointer(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '(pointer: coarse)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe('tutorial progresivo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setCoarsePointer(false);
    useGameStore.setState(useGameStore.getInitialState(), true);
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
    const marker = document.createElement('div');
    marker.className = 'player-marker';
    document.body.append(marker);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.useRealTimers();
    delete document.documentElement.dataset.tutorialTarget;
  });

  it('presenta orientación y espera a que la ruta sea visible', async () => {
    const input = new InputController();
    render(<TutorialOverlay input={input} onComplete={vi.fn()} />);

    expect(screen.getByText('Tu vehículo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Tu ruta')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Siguiente' })
        .hasAttribute('disabled'),
    ).toBe(true);

    act(() => {
      useGameStore.setState((state) => ({
        missionRoute: { ...state.missionRoute, status: 'road' },
      }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Tu objetivo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Conduce')).toBeTruthy();

    act(() => {
      input.setJoystickTurn(0.45);
      input.setTouchThrottle(0.6);
    });
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(screen.getByText('Frena y retrocede')).toBeTruthy();
    expect(document.documentElement.dataset.tutorialTarget).toBe('brake');
  });

  it('usa la tarjeta compacta y adapta el control clásico táctil', () => {
    setCoarsePointer(true);
    useSettingsStore.setState({ controlMode: 'classic-buttons' });
    useGameStore.setState((state) => ({
      missionRoute: { ...state.missionRoute, status: 'road' },
    }));

    render(
      <TutorialOverlay input={new InputController()} onComplete={vi.fn()} />,
    );

    expect(screen.getByText('Paso 1 de 9')).toBeTruthy();
    expect(
      document.querySelector('[data-tutorial-card="mobile"]'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(
      screen.getByText('Combina Avanzar con izquierda o derecha.'),
    ).toBeTruthy();
  });
});

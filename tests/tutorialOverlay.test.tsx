// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
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

describe('tutorial contextual', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setCoarsePointer(false);
    useGameStore.setState(useGameStore.getInitialState(), true);
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete document.documentElement.dataset.tutorialTarget;
  });

  it('completa acciones detectables sin botón Siguiente', async () => {
    const input = new InputController();
    render(<TutorialOverlay input={input} onComplete={vi.fn()} />);

    expect(screen.getByText('Gira el vehículo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    act(() => input.setJoystickTurn(0.45));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Aumenta la velocidad')).toBeTruthy();

    act(() => input.setTouchThrottle(0.6));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Suelta y mantén la marcha')).toBeTruthy();
    expect(document.documentElement.dataset.tutorialTarget).toBe('coast');
  });

  it('usa tarjeta compacta y adapta la instrucción al control clásico', async () => {
    setCoarsePointer(true);
    useSettingsStore.setState({ controlMode: 'classic-buttons' });
    const input = new InputController();
    render(<TutorialOverlay input={input} onComplete={vi.fn()} />);

    expect(screen.getByText('Paso 1 de 9')).toBeTruthy();
    expect(
      document.querySelector('[data-tutorial-card="mobile"]'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    act(() => input.setJoystickTurn(0.5));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(
      screen.getByText('Mantén Avanzar para ganar velocidad.'),
    ).toBeTruthy();
  });
});

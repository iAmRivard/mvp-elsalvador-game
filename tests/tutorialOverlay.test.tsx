// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorialOverlay } from '../src/components/menu/TutorialOverlay';
import { InputController } from '../src/game/inputController';
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
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete document.documentElement.dataset.tutorialTarget;
  });

  it('avanza cuando detecta la acción solicitada', async () => {
    const input = new InputController();
    render(<TutorialOverlay input={input} onComplete={vi.fn()} />);

    expect(screen.getByText('Prueba la dirección')).toBeTruthy();
    act(() => input.setJoystickTurn(0.45));
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(screen.getByText('Inicia el recorrido')).toBeTruthy();
    expect(document.documentElement.dataset.tutorialTarget).toBe('throttle');
  });

  it('adapta las instrucciones al control clásico táctil', () => {
    setCoarsePointer(true);
    useSettingsStore.setState({ controlMode: 'classic-buttons' });

    render(
      <TutorialOverlay input={new InputController()} onComplete={vi.fn()} />,
    );

    expect(
      screen.getByText('Usa izquierda o derecha en la cruceta.'),
    ).toBeTruthy();
  });
});

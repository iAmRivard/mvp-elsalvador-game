// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerHud } from '../src/components/hud/PlayerHud';
import { useGameStore } from '../src/store/gameStore';

describe('HUD detenido', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('permanece compacto tres segundos y solo se expande por acción manual', () => {
    render(<PlayerHud />);
    const hud = screen.getByLabelText('Estado del jugador');

    expect(hud.classList.contains('player-hud--compact-stopped')).toBe(true);
    expect(
      screen.queryByRole('button', {
        name: 'Expandir información del vehículo',
      }),
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(
      screen.queryByRole('button', {
        name: 'Expandir información del vehículo',
      }),
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    const expand = screen.getByRole('button', {
      name: 'Expandir información del vehículo',
    });
    expect(hud.classList.contains('player-hud--compact-stopped')).toBe(true);

    fireEvent.click(expand);
    expect(hud.classList.contains('player-hud--compact-stopped')).toBe(false);

    act(() =>
      useGameStore.setState({ activeRadioEventId: 'radio-ruta-occidental' }),
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(hud.classList.contains('player-hud--compact-stopped')).toBe(true);
  });

  it('se desmonta mientras la bitácora está abierta', () => {
    render(<PlayerHud />);
    act(() => useGameStore.getState().openJournal('missions'));

    expect(screen.queryByLabelText('Estado del jugador')).toBeNull();
  });
  it('desmonta el HUD de escritorio durante conducción móvil', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    useGameStore.setState({ presentationMode: 'driving' });
    render(<PlayerHud />);

    expect(screen.queryByLabelText('Estado del jugador')).toBeNull();
  });
});

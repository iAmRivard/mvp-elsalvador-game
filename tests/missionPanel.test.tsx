// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissionPanel } from '../src/components/hud/MissionPanel';
import { useGameStore } from '../src/store/gameStore';

describe('CTA móvil de misión', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(cleanup);

  it('muestra iniciar sin scroll y cambia a continuar durante una misión', () => {
    render(<MissionPanel />);

    expect(screen.getByTestId('mobile-mission-cta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iniciar misión' })).toBeTruthy();
    expect(screen.getAllByText('La transmisión').length).toBeGreaterThan(0);

    act(() => {
      useGameStore.setState({ activeMissionId: 'la-transmision' });
    });
    expect(
      screen.getByRole('button', { name: 'Continuar misión' }),
    ).toBeTruthy();
  });

  it('ofrece ir al inicio cuando el jugador está lejos', () => {
    useGameStore.setState((state) => ({
      telemetry: {
        ...state.telemetry,
        longitude: -88.177222,
        latitude: 13.480278,
      },
    }));
    render(<MissionPanel />);

    expect(screen.getByRole('button', { name: 'Ir al inicio' })).toBeTruthy();
  });
});

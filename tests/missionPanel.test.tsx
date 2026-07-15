// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
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

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('muestra el resumen y lo colapsa al moverse tras 2.5 segundos', () => {
    vi.useFakeTimers();
    render(<MissionPanel />);

    expect(screen.getByTestId('mobile-mission-cta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iniciar misión' })).toBeTruthy();
    expect(screen.getAllByText('La transmisión').length).toBeGreaterThan(0);

    act(() => {
      useGameStore.setState({ activeMissionId: 'la-transmision' });
    });
    expect(
      screen
        .getByLabelText('Panel de misiones')
        .getAttribute('data-mobile-sheet-state'),
    ).toBe('half');
    expect(
      screen.getByRole('button', { name: 'Cerrar bitácora' }),
    ).toBeTruthy();
    expect(screen.queryByText('Continuar misión')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2_600);
      useGameStore.setState((state) => ({
        telemetry: {
          ...state.telemetry,
          speedMetersPerSecond: 2,
          speedKilometersPerHour: 7.2,
        },
      }));
    });
    expect(screen.getByTestId('mobile-mini-navigator')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Ver objetivo de La transmisión',
      }),
    ).toBeTruthy();
    expect(screen.queryByText('Continuar misión')).toBeNull();
  });

  it('abre la bitácora como bottom sheet y alterna 55%/85%', () => {
    useGameStore.setState({ activeMissionId: 'la-transmision' });
    render(<MissionPanel />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver objetivo de La transmisión',
      }),
    );
    const panel = screen.getByLabelText('Panel de misiones');
    expect(panel.getAttribute('data-mobile-sheet-state')).toBe('half');
    expect(panel.classList.contains('mission-panel--journal-sheet')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Expandir bitácora' }));
    expect(panel.getAttribute('data-mobile-sheet-state')).toBe('expanded');
    expect(panel.classList.contains('mission-panel--sheet-expanded')).toBe(
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar bitácora' }));
    expect(panel.getAttribute('data-mobile-sheet-state')).toBe('compact');
    expect(screen.getByTestId('mobile-mini-navigator')).toBeTruthy();
  });

  it('oculta la guía de avance real mientras la velocidad firmada es reversa', () => {
    useGameStore.setState((state) => ({
      activeMissionId: 'la-transmision',
      telemetry: {
        ...state.telemetry,
        speedMetersPerSecond: -1,
        speedKilometersPerHour: 3.6,
      },
      missionRoute: {
        ...state.missionRoute,
        status: 'road',
        distanceMeters: 1_400,
        nextInstruction: {
          type: 'turn-left',
          coordinates: [-89.2, 13.7],
          distanceFromPreviousMeters: 180,
          distanceFromRouteStartMeters: 180,
          routeCoordinateIndex: 1,
          text: 'Gira a la izquierda',
        },
        distanceToNextInstructionMeters: 180,
        activeNavigation: {
          routeSegmentIndex: 0,
          recommendedHeading: 270,
          maneuverType: 'turn-left',
          maneuverCoordinates: [-89.2, 13.7],
          distanceToManeuverMeters: 180,
          distanceToRouteMeters: 0,
          requiresRejoin: false,
        },
        orientation: {
          physicalHeading: 90,
          recommendedHeading: 270,
          headingDifference: 180,
        },
      },
    }));
    render(<MissionPanel />);

    expect(screen.getByText('Reversa · guía pausada')).toBeTruthy();
    expect(screen.queryByText(/En 180 m/i)).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver objetivo de La transmisión',
      }),
    );
    expect(screen.getByText('Guía pausada en reversa')).toBeTruthy();
    expect(screen.queryByText(/Gira a la izquierda/i)).toBeNull();
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

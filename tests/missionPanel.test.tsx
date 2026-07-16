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

  it('muestra el resumen y mantiene cerrada la bitácora al iniciar', () => {
    vi.useFakeTimers();
    render(<MissionPanel />);

    expect(screen.getByTestId('mobile-mission-cta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iniciar misión' })).toBeTruthy();
    expect(screen.getAllByText('La transmisión').length).toBeGreaterThan(0);

    act(() => {
      useGameStore.setState({ activeMissionId: 'la-transmision' });
    });
    expect(screen.queryByLabelText('Panel de misiones')).toBeNull();
    expect(useGameStore.getState().isJournalOpen).toBe(false);
    expect(screen.queryByText('Continuar misión')).toBeNull();
  });

  it('abre la bitácora como bottom sheet y alterna 55%/85%', () => {
    useGameStore.setState({ activeMissionId: 'la-transmision' });
    render(<MissionPanel />);

    expect(screen.queryByLabelText('Panel de misiones')).toBeNull();
    act(() => useGameStore.getState().openJournal('missions'));
    const panel = screen.getByLabelText('Panel de misiones');
    expect(panel.getAttribute('data-mobile-sheet-state')).toBe('half');
    expect(panel.classList.contains('mission-panel--journal-sheet')).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      isJournalOpen: true,
      journalSection: 'missions',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Expandir bitácora' }));
    expect(panel.getAttribute('data-mobile-sheet-state')).toBe('expanded');
    expect(panel.classList.contains('mission-panel--sheet-expanded')).toBe(
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar bitácora' }));
    expect(screen.queryByLabelText('Panel de misiones')).toBeNull();
    expect(useGameStore.getState().isJournalOpen).toBe(false);
  });

  it('oculta la guía de avance real mientras la velocidad firmada es reversa', () => {
    useGameStore.setState((state) => ({
      activeMissionId: 'la-transmision',
      telemetry: {
        ...state.telemetry,
        longitude: -89.5,
        latitude: 13.9,
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

  it('oculta la CTA de misión durante onboarding y expone solo acciones reales', () => {
    useGameStore.setState({
      onboardingState: 'driving-basics',
      presentationMode: 'driving',
    });
    const { rerender } = render(<MissionPanel />);

    expect(screen.queryByTestId('mobile-mission-cta')).toBeNull();
    expect(screen.queryByLabelText('Panel de misiones')).toBeNull();

    act(() => useGameStore.getState().openJournal('missions'));
    rerender(<MissionPanel />);
    expect(screen.getByLabelText('Panel de misiones')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Cerrar bitácora' }),
    ).toBeTruthy();
    act(() => useGameStore.getState().closeJournal());

    act(() => {
      useGameStore.setState({ onboardingState: 'navigation-basics' });
    });
    rerender(<MissionPanel />);
    expect(screen.getByLabelText('Panel de misiones')).toBeTruthy();

    act(() => {
      useGameStore.setState({
        onboardingState: 'completed',
        activeMissionId: 'la-transmision',
      });
      useGameStore.getState().openJournal('missions');
    });
    rerender(<MissionPanel />);
    expect(
      screen
        .getByLabelText('Panel de misiones')
        .getAttribute('data-context-action'),
    ).toBe('Escuchar señal');
    expect(screen.queryByRole('button', { name: 'Escuchar señal' })).toBeNull();
  });
});

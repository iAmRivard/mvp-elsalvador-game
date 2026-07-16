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

async function reachCoast(input: InputController): Promise<void> {
  act(() => input.setJoystickTurn(0.5));
  await act(() => vi.advanceTimersByTimeAsync(420));
  act(() => input.setTouchThrottle(0.6));
  await act(() => vi.advanceTimersByTimeAsync(420));
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

  it('completa acciones detectables sin botón Siguiente ni Entendido', async () => {
    const input = new InputController();
    render(<TutorialOverlay input={input} onComplete={vi.fn()} />);

    expect(screen.getByText('Gira el vehículo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entendido' })).toBeNull();
    act(() => input.setJoystickTurn(0.45));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Elige tu velocidad')).toBeTruthy();

    act(() => input.setTouchThrottle(0.6));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Mantén la marcha')).toBeTruthy();
    expect(document.documentElement.dataset.tutorialTarget).toBe('coast');
    expect(useGameStore.getState().onboardingState).toBe('driving-basics');
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
    act(() => input.setJoystickTurn(0.5));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(
      screen.getByText('Mantén Avanzar para ganar velocidad.'),
    ).toBeTruthy();
  });

  it('exige sostener la marcha centrada durante 600 ms', async () => {
    const input = new InputController();
    render(<TutorialOverlay input={input} onComplete={vi.fn()} />);
    await reachCoast(input);

    act(() => {
      input.setTouchThrottle(0);
      useGameStore.setState((state) => ({
        telemetry: {
          ...state.telemetry,
          speedMetersPerSecond: 10 / 3.6,
          speedKilometersPerHour: 10,
        },
      }));
    });
    await act(() => vi.advanceTimersByTimeAsync(500));
    act(() => useGameStore.getState().openJournal('missions'));
    await act(() => vi.advanceTimersByTimeAsync(600));
    act(() => useGameStore.getState().closeJournal());
    await act(() => vi.advanceTimersByTimeAsync(599));
    expect(screen.getByText('Mantén la marcha')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(1));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Frena de verdad')).toBeTruthy();
  });

  it('reinicia los 1.5 s de visibilidad al cambiar el objetivo actual', async () => {
    const input = new InputController();
    useGameStore.setState((state) => ({
      activeMissionId: 'la-transmision',
      telemetry: {
        ...state.telemetry,
        longitude: -89.2,
        latitude: 13.7,
      },
      missionRoute: {
        ...state.missionRoute,
        status: 'road',
        offRoute: false,
        activeNavigation: {
          routeSegmentIndex: 0,
          recommendedHeading: 0,
          maneuverType: 'continue',
          maneuverCoordinates: [-89.2, 13.71],
          distanceToManeuverMeters: 100,
          distanceToRouteMeters: 0,
          requiresRejoin: false,
        },
      },
      driving: {
        ...state.driving,
        surface: 'primary',
        roadNetworkStatus: 'ready',
      },
      currentMissionObjectiveVisibility: {
        objectiveId: 'sintonizar-transmision',
        isVisible: true,
      },
    }));
    render(<TutorialOverlay input={input} onComplete={vi.fn()} />);

    act(() => input.setJoystickTurn(0.5));
    await act(() => vi.advanceTimersByTimeAsync(420));
    act(() => input.setTouchThrottle(0.6));
    await act(() => vi.advanceTimersByTimeAsync(420));
    act(() => {
      input.setTouchThrottle(0);
      useGameStore.setState((state) => ({
        telemetry: {
          ...state.telemetry,
          speedMetersPerSecond: 15 / 3.6,
          speedKilometersPerHour: 15,
        },
      }));
    });
    await act(() => vi.advanceTimersByTimeAsync(600));
    await act(() => vi.advanceTimersByTimeAsync(420));
    act(() => {
      input.setTouchThrottle(-1);
      useGameStore.setState((state) => ({
        telemetry: {
          ...state.telemetry,
          speedMetersPerSecond: 8 / 3.6,
          speedKilometersPerHour: 8,
        },
      }));
    });
    await act(() => vi.advanceTimersByTimeAsync(420));
    act(() => {
      input.setTouchThrottle(0);
      useGameStore.setState((state) => ({
        telemetry: {
          ...state.telemetry,
          speedMetersPerSecond: 10 / 3.6,
          speedKilometersPerHour: 10,
        },
      }));
    });
    await act(() => vi.advanceTimersByTimeAsync(800));
    act(() => useGameStore.getState().openJournal('missions'));
    await act(() => vi.advanceTimersByTimeAsync(800));
    act(() => useGameStore.getState().closeJournal());
    await act(() => vi.advanceTimersByTimeAsync(899));
    expect(screen.getByText('Sigue la línea cian')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(1));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Reconoce el objetivo')).toBeTruthy();

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    act(() => useGameStore.getState().openJournal('missions'));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    act(() => useGameStore.getState().closeJournal());
    await act(() => vi.advanceTimersByTimeAsync(1_499));
    expect(screen.getByText('Reconoce el objetivo')).toBeTruthy();
    act(() =>
      useGameStore.setState({
        activeMissionCompletedObjectiveIds: ['sintonizar-transmision'],
        currentMissionObjectiveVisibility: {
          objectiveId: 'llegar-repetidor-oeste',
          isVisible: true,
        },
      }),
    );
    await act(() => vi.advanceTimersByTimeAsync(1_499));
    expect(screen.getByText('Reconoce el objetivo')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(1));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Acércate para interactuar')).toBeTruthy();
  });

  it('omitir cambia solo el onboarding y conserva la misión', () => {
    const input = new InputController();
    const finish = vi.fn();
    useGameStore.setState({ activeMissionId: 'la-transmision' });
    render(<TutorialOverlay input={input} onComplete={finish} />);

    fireEvent.click(screen.getByRole('button', { name: 'Omitir' }));

    expect(useGameStore.getState().onboardingState).toBe('skipped');
    expect(useGameStore.getState().activeMissionId).toBe('la-transmision');
    expect(finish).toHaveBeenCalledTimes(1);
  });
});

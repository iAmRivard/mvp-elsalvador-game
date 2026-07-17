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
import { onboardingIsActive } from '../src/types/onboarding';

function setCoarsePointer(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

async function reachCoast(input: InputController): Promise<void> {
  act(() => input.setTouchThrottle(0.6));
  await act(() => vi.advanceTimersByTimeAsync(420));
  act(() => {
    input.setJoystickTurn(0.5);
    useGameStore.setState((state) => ({
      telemetry: {
        ...state.telemetry,
        speedMetersPerSecond: 10 / 3.6,
        speedKilometersPerHour: 10,
        heading: state.telemetry.heading + 8,
      },
    }));
  });
  await act(() => vi.advanceTimersByTimeAsync(420));
}

function TutorialHarness({
  input,
  onComplete,
}: {
  input: InputController;
  onComplete: () => void;
}) {
  const onboardingState = useGameStore((state) => state.onboardingState);
  return onboardingIsActive(onboardingState) ? (
    <TutorialOverlay input={input} onComplete={onComplete} />
  ) : (
    <div data-testid="free-driving" />
  );
}

describe('tutorial obligatorio', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setCoarsePointer(false);
    useGameStore.setState(
      {
        ...useGameStore.getInitialState(),
        onboardingState: 'driving-basics',
      },
      true,
    );
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete document.documentElement.dataset.tutorialTarget;
  });

  it('avanza acciones detectables sin botón Siguiente ni Entendido', async () => {
    const input = new InputController();
    render(<TutorialOverlay input={input} onComplete={vi.fn()} />);

    expect(screen.getByText('Elige tu velocidad')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entendido' })).toBeNull();
    act(() => input.setTouchThrottle(0.6));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Gira en movimiento')).toBeTruthy();

    act(() => {
      input.setJoystickTurn(0.45);
      useGameStore.setState((state) => ({
        telemetry: {
          ...state.telemetry,
          speedMetersPerSecond: 10 / 3.6,
          speedKilometersPerHour: 10,
          heading: state.telemetry.heading + 8,
        },
      }));
    });
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Mantén la marcha')).toBeTruthy();
    expect(document.documentElement.dataset.tutorialTarget).toBe('coast');
  });

  it('usa tarjeta compacta de cinco pasos', async () => {
    setCoarsePointer(true);
    useSettingsStore.setState({ controlMode: 'classic-buttons' });
    const input = new InputController();
    render(<TutorialOverlay input={input} onComplete={vi.fn()} />);

    expect(screen.getByText('Paso 1 de 5')).toBeTruthy();
    expect(
      document.querySelector('[data-tutorial-card="mobile"]'),
    ).toBeTruthy();
    act(() => input.setTouchThrottle(0.6));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(
      screen.getByText('Gira en movimiento'),
    ).toBeTruthy();
  });

  it('no acepta un giro automático sin intención lateral del jugador', async () => {
    const input = new InputController();
    render(<TutorialOverlay input={input} onComplete={vi.fn()} />);
    act(() => input.setTouchThrottle(0.6));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Gira en movimiento')).toBeTruthy();

    act(() => {
      useGameStore.setState((state) => ({
        telemetry: {
          ...state.telemetry,
          speedMetersPerSecond: 10 / 3.6,
          speedKilometersPerHour: 10,
          heading: state.telemetry.heading + 12,
        },
      }));
    });
    await act(() => vi.advanceTimersByTimeAsync(420));

    expect(screen.getByText('Gira en movimiento')).toBeTruthy();
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
    await act(() => vi.advanceTimersByTimeAsync(599));
    expect(screen.getByText('Mantén la marcha')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(1));
    await act(() => vi.advanceTimersByTimeAsync(420));
    expect(screen.getByText('Frena de verdad')).toBeTruthy();
  });

  it('reanuda navigation-basics en ruta y termina la tarjeta sin tocar la misión', async () => {
    const input = new InputController();
    const finish = vi.fn();
    useGameStore.setState((state) => ({
      onboardingState: 'navigation-basics',
      activeMissionId: 'la-transmision',
      activeMissionCompletedObjectiveIds: [],
      telemetry: {
        ...state.telemetry,
        speedMetersPerSecond: 15 / 3.6,
        speedKilometersPerHour: 15,
      },
      missionRoute: {
        ...state.missionRoute,
        status: 'road',
        visualReady: true,
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
      isPaused: false,
    }));
    render(<TutorialHarness input={input} onComplete={finish} />);

    expect(screen.getByText('Sigue la línea cian')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(900));
    await act(() => vi.advanceTimersByTimeAsync(420));

    expect(screen.getByTestId('free-driving')).toBeTruthy();
    expect(finish).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState()).toMatchObject({
      onboardingState: 'completed',
      activeMissionId: 'la-transmision',
      activeMissionCompletedObjectiveIds: [],
    });
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

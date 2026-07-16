// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RADIO_FULL_PREVIEW_MILLISECONDS,
} from '../src/components/story/RadioMessageOverlay';
import { OverlayManager } from '../src/components/ui/OverlayManager';
import { InputController } from '../src/game/inputController';
import { useGameStore } from '../src/store/gameStore';

function setMobileViewport(matches: boolean): void {
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

function advanceRadioPreview(): void {
  act(() => {
    vi.advanceTimersByTime(RADIO_FULL_PREVIEW_MILLISECONDS);
  });
}

describe('overlay manager', () => {
  beforeEach(() => {
    setMobileViewport(false);
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('shows expanded radio as the only large overlay and compacts discovery', () => {
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
      lastDiscoveredLocationId: 'san-salvador',
      isPaused: false,
    });
    const { container } = render(<OverlayManager />);

    expect(screen.getByText('La señal continúa al oeste')).toBeTruthy();
    expect(screen.getAllByText('San Salvador').length).toBeGreaterThan(0);
    expect(container.querySelector('.discovery-toast--compact')).not.toBeNull();
    expect(
      container
        .querySelector('.overlay-manager')
        ?.getAttribute('data-active-overlay'),
    ).toBe('radio');
    expect(useGameStore.getState().isPaused).toBe(false);
  });

  it('keeps discovery compact while the vehicle is moving fast', () => {
    useGameStore.getState().setTelemetry({
      longitude: -89.1908911,
      latitude: 13.6962937,
      heading: 0,
      speedMetersPerSecond: 20,
      fuel: 75,
      totalDistanceMeters: 0,
    });
    useGameStore.setState({
      lastDiscoveredLocationId: 'san-salvador',
    });
    const { container } = render(<OverlayManager />);

    expect(container.querySelector('.discovery-toast--compact')).not.toBeNull();
    expect(
      container
        .querySelector('.overlay-manager')
        ?.getAttribute('data-active-overlay'),
    ).toBe('none');
  });

  it('queues expanded radio until mandatory narrative is dismissed', () => {
    useGameStore.getState().startMission('la-transmision');
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
      lastDiscoveredLocationId: 'san-salvador',
    });
    render(<OverlayManager />);

    const dialog = screen.getByRole('dialog');
    expect(screen.queryByText('La señal continúa al oeste')).toBeNull();
    expect(screen.queryAllByText('San Salvador').length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole('button'));
    expect(screen.getByText('La señal continúa al oeste')).toBeTruthy();
    expect(document.querySelector('.discovery-toast--compact')).not.toBeNull();
  });

  it('keeps recovery ahead of narrative', () => {
    useGameStore.getState().startMission('la-transmision');
    useGameStore.setState({ recoveryReason: 'fuel', isPaused: true });
    const { container } = render(<OverlayManager />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText('Sin combustible')).toBeNull();
    expect(screen.getByText(/Una señal de auxilio apareció/)).toBeTruthy();
    expect(
      container.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
    ).toHaveLength(1);
  });

  it('suppresses story overlays during contextual onboarding', () => {
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
      recoveryReason: null,
    });
    const { container } = render(<OverlayManager allowStory={false} />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      container
        .querySelector('.overlay-manager')
        ?.getAttribute('data-active-overlay'),
    ).toBe('none');
  });

  it('keeps radio large through 4,499 ms and makes it compact at 4,500 ms', () => {
    vi.useFakeTimers();
    setMobileViewport(true);
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
    });
    const { container } = render(<OverlayManager />);
    const manager = container.querySelector('.overlay-manager');

    expect(manager?.getAttribute('data-active-overlay')).toBe('radio');
    expect(manager?.getAttribute('data-radio-large-blocker')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(RADIO_FULL_PREVIEW_MILLISECONDS - 1);
    });
    expect(container.querySelector('.radio-message--compact')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelector('.radio-message--compact')).not.toBeNull();
    expect(manager?.getAttribute('data-active-overlay')).toBe('none');
    expect(manager?.getAttribute('data-radio-display-mode')).toBe('compact');
    expect(manager?.getAttribute('data-radio-large-blocker')).toBe('false');
  });

  it('shows objective advice with compact radio and restores the large slot on expansion', () => {
    vi.useFakeTimers();
    setMobileViewport(true);
    useGameStore.getState().setTelemetry({
      longitude: -89.3175451,
      latitude: 13.6820687,
      heading: 0,
      speedMetersPerSecond: 0,
      fuel: 75,
      totalDistanceMeters: 0,
    });
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
      activeMissionId: 'la-transmision',
      activeMissionCompletedObjectiveIds: ['sintonizar-transmision'],
    });
    const { container } = render(
      <OverlayManager input={new InputController()} showContextualAdvice />,
    );

    expect(
      container.querySelector('[data-contextual-advice="objective"]'),
    ).toBeNull();
    advanceRadioPreview();
    expect(
      container.querySelector('[data-contextual-advice="objective"]'),
    ).not.toBeNull();
    expect(container.querySelector('.radio-message--compact')).not.toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Expandir transmisión de radio',
      }),
    );
    const manager = container.querySelector('.overlay-manager');
    expect(manager?.getAttribute('data-active-overlay')).toBe('radio');
    expect(manager?.getAttribute('data-radio-large-blocker')).toBe('true');
    expect(
      container.querySelector('[data-contextual-advice="objective"]'),
    ).toBeNull();
  });

  it('keeps interaction advice ahead of objective and journal with compact radio', () => {
    vi.useFakeTimers();
    setMobileViewport(true);
    useGameStore.getState().setTelemetry({
      longitude: -89.191111,
      latitude: 13.6975,
      heading: 0,
      speedMetersPerSecond: 0,
      fuel: 75,
      totalDistanceMeters: 0,
    });
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
      activeMissionId: 'la-transmision',
      activeMissionCompletedObjectiveIds: [],
    });
    const { container } = render(
      <OverlayManager input={new InputController()} showContextualAdvice />,
    );

    advanceRadioPreview();
    expect(
      container.querySelector('[data-contextual-advice="interaction"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-contextual-advice="objective"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-contextual-advice="journal"]'),
    ).toBeNull();
  });

  it('keeps compact radio from expanding under mandatory narrative', () => {
    vi.useFakeTimers();
    setMobileViewport(true);
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
    });
    const { container } = render(<OverlayManager />);
    advanceRadioPreview();
    act(() => {
      useGameStore.setState({
        activeNarrativeEventId: 'radio-transmision-inicial',
      });
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Expandir transmisión de radio',
      }),
    );
    const manager = container.querySelector('.overlay-manager');
    expect(manager?.getAttribute('data-active-overlay')).toBe('narrative');
    expect(manager?.getAttribute('data-radio-display-mode')).toBe('compact');
    expect(container.querySelector('.radio-message--compact')).not.toBeNull();
    expect(manager?.getAttribute('data-radio-expansion-blocked')).toBe('true');
  });

  it('resets the full preview timer when the active radio changes', () => {
    vi.useFakeTimers();
    setMobileViewport(true);
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
    });
    const { container } = render(<OverlayManager />);
    advanceRadioPreview();
    expect(container.querySelector('.radio-message--compact')).not.toBeNull();

    act(() => {
      useGameStore.setState({
        activeRadioEventId: 'radio-camino-bloqueado',
      });
    });
    expect(container.querySelector('.radio-message--compact')).toBeNull();
    expect(screen.getByText('Advertencia en la carretera')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(RADIO_FULL_PREVIEW_MILLISECONDS - 1);
    });
    expect(container.querySelector('.radio-message--compact')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelector('.radio-message--compact')).not.toBeNull();
  });
});

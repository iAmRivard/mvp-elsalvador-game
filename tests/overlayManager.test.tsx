// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OverlayManager } from '../src/components/ui/OverlayManager';
import { useGameStore } from '../src/store/gameStore';

describe('overlay manager', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  afterEach(cleanup);

  it('shows radio as the only large overlay and compacts discovery', () => {
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

  it('queues radio until mandatory narrative is dismissed', () => {
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
});

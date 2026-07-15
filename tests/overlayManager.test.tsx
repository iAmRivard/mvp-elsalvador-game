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
    useGameStore.setState({
      lastDiscoveredLocationId: 'san-salvador',
      presentationMode: 'fast',
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
    expect(screen.queryByText('San Salvador')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button'));
    expect(screen.getByText('La señal continúa al oeste')).toBeTruthy();
    expect(document.querySelector('.discovery-toast--compact')).not.toBeNull();
  });

  it('keeps recovery ahead of narrative', () => {
    useGameStore.getState().startMission('la-transmision');
    useGameStore.setState({ recoveryReason: 'fuel', isPaused: true });
    const { container } = render(<OverlayManager />);

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Sin combustible')).toBeTruthy();
    expect(screen.queryByText(/Una señal de auxilio apareció/)).toBeNull();
    expect(
      container.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
    ).toHaveLength(1);
  });
});

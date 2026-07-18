// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DISCOVERY_TOAST_MILLISECONDS,
  DiscoveryToast,
} from '../src/components/hud/DiscoveryToast';
import { useGameStore } from '../src/store/gameStore';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('aviso de descubrimiento', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.setState(useGameStore.getInitialState(), true);
    useGameStore.setState({
      lastDiscoveredLocationId: 'san-salvador',
      discoveredLocationIds: ['san-salvador'],
    });
  });

  it('desaparece en 2–3 segundos sin borrar el descubrimiento', async () => {
    render(<DiscoveryToast />);
    expect(screen.getByRole('status')).toBeTruthy();

    await act(() =>
      vi.advanceTimersByTimeAsync(DISCOVERY_TOAST_MILLISECONDS - 1),
    );
    expect(screen.getByRole('status')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(screen.queryByRole('status')).toBeNull();
    expect(useGameStore.getState().discoveredLocationIds).toContain(
      'san-salvador',
    );
    expect(DISCOVERY_TOAST_MILLISECONDS).toBeGreaterThanOrEqual(2_000);
    expect(DISCOVERY_TOAST_MILLISECONDS).toBeLessThanOrEqual(3_000);
  });
});

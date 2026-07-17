// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NarrativeDialog } from '../src/components/story/NarrativeDialog';
import {
  RADIO_FULL_PREVIEW_MILLISECONDS,
  RadioMessageOverlay,
  type RadioDisplayMode,
} from '../src/components/story/RadioMessageOverlay';
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

function ControlledRadioMessageOverlay({
  initialMode = 'expanded',
}: {
  initialMode?: RadioDisplayMode;
}) {
  const [displayMode, setDisplayMode] =
    useState<RadioDisplayMode>(initialMode);
  return (
    <RadioMessageOverlay
      displayMode={displayMode}
      mobileViewport={window.matchMedia('(max-width: 900px)').matches}
      onCompact={() => setDisplayMode('compact')}
      onExpandRequest={() => setDisplayMode('expanded')}
    />
  );
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('presentación narrativa', () => {
  beforeEach(() => {
    setMobileViewport(false);
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it('la radio no crea modal ni backdrop bloqueante', () => {
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
      isPaused: false,
    });
    const { container } = render(<ControlledRadioMessageOverlay />);

    expect(screen.getByText('La señal continúa al oeste')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelector('.narrative-backdrop')).toBeNull();
    expect(container.querySelector('.radio-overlay')).not.toBeNull();
    expect(useGameStore.getState().isPaused).toBe(false);
  });

  it('abre la bitácora desde una transmisión', () => {
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
    });
    render(<ControlledRadioMessageOverlay />);
    fireEvent.click(screen.getByRole('button', { name: 'Bitácora' }));

    expect(useGameStore.getState().storyLogRequest).toMatchObject({
      section: 'transmissions',
      revision: 1,
    });
    expect(useGameStore.getState().isJournalOpen).toBe(true);
    expect(useGameStore.getState().activeRadioEventId).toBeNull();
  });

  it('colapsa la radio móvil después de la vista completa y puede reabrirse', () => {
    vi.useFakeTimers();
    setMobileViewport(true);
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
    });
    const { container } = render(<ControlledRadioMessageOverlay />);

    expect(screen.getByRole('button', { name: 'Bitácora' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(RADIO_FULL_PREVIEW_MILLISECONDS - 1);
    });
    expect(container.querySelector('.radio-message--compact')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelector('.radio-message--compact')).toBeTruthy();
    expect(useGameStore.getState().activeRadioEventId).toBe(
      'radio-ruta-occidental',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Expandir transmisión de radio' }),
    );
    expect(screen.getByText('La señal continúa al oeste')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bitácora' })).toBeTruthy();
  });

  it('compactar nunca descarta ni marca leída la transmisión', () => {
    vi.useFakeTimers();
    setMobileViewport(true);
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
    });
    render(<ControlledRadioMessageOverlay />);

    act(() => {
      vi.advanceTimersByTime(RADIO_FULL_PREVIEW_MILLISECONDS * 4);
    });
    expect(useGameStore.getState()).toMatchObject({
      activeRadioEventId: 'radio-ruta-occidental',
      isJournalOpen: false,
      storyLogRequest: { revision: 0 },
    });
  });

  it('la radio de escritorio conserva la presentación completa', () => {
    vi.useFakeTimers();
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
    });
    const { container } = render(<ControlledRadioMessageOverlay />);

    act(() => {
      vi.advanceTimersByTime(RADIO_FULL_PREVIEW_MILLISECONDS * 2);
    });
    expect(container.querySelector('.radio-message--compact')).toBeNull();
    expect(screen.getByRole('button', { name: 'Bitácora' })).toBeTruthy();
  });

  it('la introducción de capítulo pausa y lo comunica', () => {
    useGameStore.getState().startMission('la-transmision');
    render(<NarrativeDialog />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('JUEGO EN PAUSA')).toBeTruthy();
    expect(screen.getByText(/Una señal de auxilio apareció/)).toBeTruthy();
    expect(useGameStore.getState().isPaused).toBe(true);
  });
});

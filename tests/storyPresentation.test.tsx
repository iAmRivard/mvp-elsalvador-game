// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NarrativeDialog } from '../src/components/story/NarrativeDialog';
import { RadioMessageOverlay } from '../src/components/story/RadioMessageOverlay';
import { useGameStore } from '../src/store/gameStore';

afterEach(cleanup);

describe('presentación narrativa', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it('la radio no crea modal ni backdrop bloqueante', () => {
    useGameStore.setState({
      activeRadioEventId: 'radio-ruta-occidental',
      isPaused: false,
    });
    const { container } = render(<RadioMessageOverlay />);

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
    render(<RadioMessageOverlay />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir bitácora' }));

    expect(useGameStore.getState().storyLogRequest).toMatchObject({
      section: 'transmissions',
      revision: 1,
    });
    expect(useGameStore.getState().activeRadioEventId).toBeNull();
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

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { useGameStore } from '../src/store/gameStore';

vi.mock('../src/components/menu/StartScreen', () => ({
  StartScreen: ({ onContinue, onNewGame }: {
    onContinue: () => void;
    onNewGame: () => void;
  }) => (
    <>
      <button type="button" onClick={onContinue}>Comenzar expedición</button>
      <button type="button" onClick={onNewGame}>Nueva partida</button>
    </>
  ),
}));
vi.mock('../src/components/map/GameMap', () => ({
  GameMap: () => <div data-testid="game-map" />,
}));
vi.mock('../src/components/audio/GameAudioBridge', () => ({
  GameAudioBridge: () => null,
}));
vi.mock('../src/components/pwa/ServiceWorkerUpdatePrompt', () => ({
  ServiceWorkerUpdatePrompt: () => null,
}));

describe('integración de onboarding con la primera misión', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(cleanup);

  it('activa La transmisión antes de mostrar el entrenamiento', async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Comenzar expedición' }),
    );

    expect(await screen.findByText('Gira el vehículo')).toBeTruthy();
    expect(useGameStore.getState()).toMatchObject({
      onboardingState: 'introducing',
      activeMissionId: 'la-transmision',
    });
  });

  it('omitir solo resuelve el onboarding y conserva la misión activa', async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Comenzar expedición' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Omitir' }));

    expect(useGameStore.getState()).toMatchObject({
      onboardingState: 'skipped',
      activeMissionId: 'la-transmision',
      activeMissionCompletedObjectiveIds: [],
    });
    expect(useGameStore.getState().completedMissionIds).not.toContain(
      'la-transmision',
    );
  });
});

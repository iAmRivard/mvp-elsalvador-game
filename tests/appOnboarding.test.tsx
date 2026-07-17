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

  it('muestra la narrativa pausante antes del entrenamiento', async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Comenzar expedición' }),
    );

    expect(await screen.findByText('Una señal de auxilio')).toBeTruthy();
    expect(screen.queryByText('Gira el vehículo')).toBeNull();
    expect(useGameStore.getState()).toMatchObject({
      onboardingState: 'introducing',
      activeMissionId: 'la-transmision',
      activeNarrativeEventId: 'radio-transmision-inicial',
      isPaused: true,
    });
  });

  it('Comenzar investigación abre driving-basics sin completar objetivos', async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Comenzar expedición' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Comenzar investigación' }),
    );

    expect(useGameStore.getState()).toMatchObject({
      onboardingState: 'driving-basics',
      activeMissionId: 'la-transmision',
      activeMissionCompletedObjectiveIds: [],
      activeNarrativeEventId: null,
      isPaused: false,
    });
    expect(await screen.findByText('Elige tu velocidad')).toBeTruthy();
    expect(useGameStore.getState().completedMissionIds).not.toContain(
      'la-transmision',
    );
  });

  it('una partida cargada no reinicia misión ni onboarding', () => {
    useGameStore.setState({
      onboardingState: 'completed',
      activeMissionId: 'la-transmision',
      hasSavedGame: true,
    });
    useGameStore.getState().saveGame();
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Comenzar expedición' }),
    );

    expect(useGameStore.getState()).toMatchObject({
      onboardingState: 'completed',
      activeMissionId: 'la-transmision',
      activeNarrativeEventId: null,
    });
  });

  it('restaura la narrativa si el autosave ocurrió durante introducing', async () => {
    useGameStore.setState({
      onboardingState: 'introducing',
      activeMissionId: 'la-transmision',
      activeMissionCompletedObjectiveIds: [],
      activeNarrativeEventId: 'radio-transmision-inicial',
      isPaused: true,
    });
    expect(useGameStore.getState().saveGame()).toBe(true);
    useGameStore.setState(
      {
        ...useGameStore.getInitialState(),
        hasSavedGame: true,
      },
      true,
    );

    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Comenzar expedición' }),
    );

    expect(await screen.findByText('Una señal de auxilio')).toBeTruthy();
    expect(screen.queryByText('Gira el vehículo')).toBeNull();
    expect(useGameStore.getState()).toMatchObject({
      onboardingState: 'introducing',
      activeMissionId: 'la-transmision',
      activeNarrativeEventId: 'radio-transmision-inicial',
      isPaused: true,
    });
  });

  it('migra un introducing legado sin narrativa a driving-basics', async () => {
    useGameStore.setState({
      onboardingState: 'introducing',
      activeMissionId: null,
      activeNarrativeEventId: null,
      isPaused: false,
    });
    expect(useGameStore.getState().saveGame()).toBe(true);
    useGameStore.setState(
      {
        ...useGameStore.getInitialState(),
        hasSavedGame: true,
      },
      true,
    );

    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Comenzar expedición' }),
    );

    expect(await screen.findByTestId('game-map')).toBeTruthy();
    expect(screen.queryByText(/Gira el/)).toBeNull();
    expect(useGameStore.getState()).toMatchObject({
      onboardingState: 'completed',
      activeMissionId: null,
      activeNarrativeEventId: null,
      isPaused: false,
    });
  });
});

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  GAME_SAVE_KEY,
  type GameSaveEnvelope,
} from '../src/store/gamePersistence';
import { useGameStore } from '../src/store/gameStore';

describe('estado global de onboarding y diario', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it('inicia una partida nueva sin tutorial resuelto', () => {
    useGameStore.getState().setOnboardingState('completed');
    useGameStore.getState().resetGame();

    expect(useGameStore.getState()).toMatchObject({
      onboardingState: 'not-started',
      isJournalOpen: false,
    });
  });

  it('persiste el estado explícito sin persistir el diario abierto', () => {
    useGameStore.getState().setOnboardingState('interaction-basics');
    useGameStore.getState().openJournal('transmissions');
    expect(useGameStore.getState().saveGame()).toBe(true);

    const envelope = JSON.parse(
      window.localStorage.getItem(GAME_SAVE_KEY)!,
    ) as GameSaveEnvelope & {
      game: GameSaveEnvelope['game'] & { isJournalOpen?: unknown };
    };
    expect(envelope.game.onboardingState).toBe('interaction-basics');
    expect(envelope.game.isJournalOpen).toBeUndefined();

    useGameStore.getState().closeJournal();
    useGameStore.getState().setOnboardingState('skipped');
    expect(useGameStore.getState().loadGame()).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      onboardingState: 'completed',
      isJournalOpen: false,
      journalSection: 'missions',
    });
  });

  it('abrir el diario actualiza sección y solicitud en una sola transición', () => {
    const revision = useGameStore.getState().storyLogRequest.revision;
    useGameStore.getState().openJournal('discoveries');

    expect(useGameStore.getState()).toMatchObject({
      isJournalOpen: true,
      journalSection: 'discoveries',
      storyLogRequest: {
        section: 'discoveries',
        revision: revision + 1,
      },
    });
  });
});

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InputController } from '../../game/inputController';
import { useGameStore } from '../../store/gameStore';
import {
  resolveOverlayQueue,
  type OverlayCandidate,
  type OverlayKind,
} from '../../ui/overlayPriority';
import { DiscoveryToast } from '../hud/DiscoveryToast';
import { VehicleRecoveryDialog } from '../menu/VehicleRecoveryDialog';
import { MissionChoiceDialog } from '../story/MissionChoiceDialog';
import { NarrativeDialog } from '../story/NarrativeDialog';
import { RadioMessageOverlay } from '../story/RadioMessageOverlay';
import { TutorialOverlay } from '../menu/TutorialOverlay';
import {
  ContextualAdviceOverlay,
  useContextualAdviceController,
} from '../tutorial/ContextualAdviceOverlay';

interface OverlayManagerProps {
  allowDiscovery?: boolean;
  allowStory?: boolean;
  input?: InputController;
  showTutorial?: boolean;
  showContextualAdvice?: boolean;
  onTutorialComplete?: () => void;
  onTutorialSkip?: () => void;
}

export function OverlayManager({
  allowDiscovery = true,
  allowStory = true,
  input,
  showTutorial = false,
  showContextualAdvice = false,
  onTutorialComplete = () => undefined,
  onTutorialSkip = () => undefined,
}: OverlayManagerProps) {
  const recoveryReason = useGameStore((state) => state.recoveryReason);
  const missionChoiceId = useGameStore(
    (state) => state.activeMissionChoiceObjectiveId,
  );
  const narrativeId = useGameStore((state) => state.activeNarrativeEventId);
  const radioId = useGameStore((state) => state.activeRadioEventId);
  const discoveryId = useGameStore((state) => state.lastDiscoveredLocationId);
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);
  const storyLogEntryCount = useGameStore(
    (state) => state.storyLogEntries.length,
  );
  const presentationMode = useGameStore((state) => state.presentationMode);
  const initialStoryLogEntryCount = useRef(storyLogEntryCount);
  const [journalAdvicePending, setJournalAdvicePending] = useState(false);
  useEffect(() => {
    if (radioId || storyLogEntryCount > initialStoryLogEntryCount.current) {
      setJournalAdvicePending(true);
    }
    initialStoryLogEntryCount.current = storyLogEntryCount;
  }, [radioId, storyLogEntryCount]);
  const handleJournalAdvice = useCallback(
    () => setJournalAdvicePending(false),
    [],
  );
  const discoveryCanUseLargeOverlay =
    presentationMode === 'stopped' || presentationMode === 'interaction';
  const candidates: OverlayCandidate[] = [];
  if (allowStory && narrativeId) {
    candidates.push({
      id: `narrative:${narrativeId}`,
      kind: 'narrative',
      priority: 'narrative',
      large: true,
      sequence: 0,
    });
  }
  if (recoveryReason) {
    candidates.push({
      id: `recovery:${recoveryReason}`,
      kind: 'recovery',
      priority: 'critical',
      large: true,
      sequence: 1,
    });
  }
  if (missionChoiceId) {
    candidates.push({
      id: `mission-choice:${missionChoiceId}`,
      kind: 'mission-choice',
      priority: 'critical',
      large: true,
      sequence: 2,
    });
  }
  if (showTutorial && input) {
    candidates.push({
      id: 'tutorial:mandatory',
      kind: 'tutorial',
      priority: 'tutorial',
      large: true,
      sequence: 3,
    });
  }
  if (allowStory && radioId) {
    candidates.push({
      id: `radio:${radioId}`,
      kind: 'radio',
      priority: 'radio',
      large: true,
      sequence: 4,
    });
  }
  const hasLargeBlocker = candidates.some((candidate) => candidate.large);
  const adviceController = useContextualAdviceController({
    enabled:
      showContextualAdvice &&
      !hasLargeBlocker &&
      !isJournalOpen &&
      Boolean(input),
    input: input ?? null,
    journalHasNewContent: journalAdvicePending,
    onJournalAdviceHandled: handleJournalAdvice,
  });
  if (adviceController.advice) {
    candidates.push({
      id: `contextual-advice:${adviceController.advice.id}`,
      kind: 'contextual-advice',
      priority:
        adviceController.advice.id === 'interaction'
          ? 'interaction'
          : 'information',
      large: false,
      sequence: 5,
    });
  }
  if (allowDiscovery && discoveryId) {
    candidates.push({
      id: `discovery:${discoveryId}`,
      kind: 'discovery',
      priority: 'discovery',
      large: discoveryCanUseLargeOverlay,
      sequence: 6,
    });
  }
  const queue = resolveOverlayQueue(candidates);
  const activeKind = queue.activeLarge?.kind ?? null;
  const discoveryCompact = queue.compact.some(
    (candidate) => candidate.kind === 'discovery',
  );
  const contextualAdviceCompact = queue.compact.some(
    (candidate) => candidate.kind === 'contextual-advice',
  );
  const renderLargeOverlay = (kind: OverlayKind | null) => {
    switch (kind) {
      case 'recovery':
        return <VehicleRecoveryDialog />;
      case 'mission-choice':
        return <MissionChoiceDialog />;
      case 'narrative':
        return <NarrativeDialog />;
      case 'tutorial':
        return input ? (
          <TutorialOverlay
            input={input}
            onComplete={onTutorialComplete}
            onSkip={onTutorialSkip}
          />
        ) : null;
      case 'radio':
        return <RadioMessageOverlay />;
      case 'discovery':
        return <DiscoveryToast />;
      default:
        return null;
    }
  };

  return (
    <div
      className="overlay-manager"
      data-active-overlay={activeKind ?? 'none'}
      data-queued-overlays={queue.queuedLarge.length}
    >
      {renderLargeOverlay(activeKind)}
      {contextualAdviceCompact && adviceController.advice && (
        <ContextualAdviceOverlay
          advice={adviceController.advice}
          onDismiss={adviceController.dismiss}
          onOpenJournal={adviceController.openJournal}
        />
      )}
      {discoveryCompact && <DiscoveryToast compact />}
    </div>
  );
}

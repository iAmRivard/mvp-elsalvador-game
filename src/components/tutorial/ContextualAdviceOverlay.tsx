import { useCallback, useEffect, useRef, useState } from 'react';
import { missionById } from '../../data/missions';
import {
  selectContextualAdvice,
  type ContextualAdvice,
  type ContextualAdviceId,
} from '../../game/contextualAdvice';
import {
  interactionLabelForObjective,
  objectiveRequiresManualInteraction,
} from '../../game/interactions';
import type { InputController } from '../../game/inputController';
import { nearestPendingObjective } from '../../game/missions';
import { boostContextIsSafe } from '../../game/onboarding';
import { useGameStore } from '../../store/gameStore';

const CONTEXT_REFRESH_MILLISECONDS = 350;
const OBJECTIVE_PREVIEW_MILLISECONDS = 4_500;

interface ContextualAdviceControllerOptions {
  enabled: boolean;
  input: InputController | null;
  journalHasNewContent: boolean;
  onJournalAdviceHandled: () => void;
}

interface ContextualAdviceController {
  advice: ContextualAdvice | null;
  dismiss: () => void;
  openJournal: () => void;
}

function readAdvice(
  journalHasNewContent: boolean,
  seen: ReadonlySet<ContextualAdviceId>,
): ContextualAdvice | null {
  const state = useGameStore.getState();
  const mission = state.activeMissionId
    ? missionById.get(state.activeMissionId)
    : null;
  const nearest = mission
    ? nearestPendingObjective(
        mission,
        state.activeMissionCompletedObjectiveIds,
        [state.telemetry.longitude, state.telemetry.latitude],
      )
    : null;
  const objective = nearest?.objective;
  const interactionLabel =
    objective &&
    objectiveRequiresManualInteraction(objective) &&
    nearest.distanceMeters <= objective.radiusMeters
      ? interactionLabelForObjective(objective)
      : null;
  const objectiveRelevant = Boolean(
    nearest &&
      (nearest.distanceMeters <= 300 ||
        (state.currentMissionObjectiveVisibility.objectiveId ===
          nearest.objective.id &&
          state.currentMissionObjectiveVisibility.isVisible)),
  );
  const hasBlockingOverlay = Boolean(
    state.isPaused ||
      state.isJournalOpen ||
      state.recoveryReason ||
      state.activeNarrativeEventId ||
      state.activeMissionChoiceObjectiveId ||
      state.activeRadioEventId,
  );
  const boostIsSafe =
    !interactionLabel &&
    !objectiveRelevant &&
    boostContextIsSafe({
      speedKilometersPerHour: state.telemetry.speedKilometersPerHour,
      fuel: state.telemetry.fuel,
      condition: state.vehicle.condition,
      isPaused: state.isPaused,
      hasBlockingOverlay,
      distanceToObjectiveMeters: nearest?.distanceMeters ?? null,
    });

  return selectContextualAdvice(
    {
      interactionLabel,
      objectiveRelevant,
      journalHasNewContent,
      boostIsSafe,
    },
    seen,
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useContextualAdviceController({
  enabled,
  input,
  journalHasNewContent,
  onJournalAdviceHandled,
}: ContextualAdviceControllerOptions): ContextualAdviceController {
  const seenRef = useRef(new Set<ContextualAdviceId>());
  const adviceRef = useRef<ContextualAdvice | null>(null);
  const [advice, setAdvice] = useState<ContextualAdvice | null>(null);

  const refresh = useCallback(() => {
    const next = enabled
      ? readAdvice(journalHasNewContent, seenRef.current)
      : null;
    adviceRef.current = next;
    setAdvice((current) =>
      current?.id === next?.id &&
      current?.title === next?.title &&
      current?.message === next?.message
        ? current
        : next,
    );
  }, [enabled, journalHasNewContent]);

  const markSeen = useCallback(
    (id: ContextualAdviceId) => {
      seenRef.current.add(id);
      if (id === 'journal') onJournalAdviceHandled();
      refresh();
    },
    [onJournalAdviceHandled, refresh],
  );

  useEffect(() => {
    refresh();
    if (!enabled) return;
    const interval = window.setInterval(refresh, CONTEXT_REFRESH_MILLISECONDS);
    return () => window.clearInterval(interval);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !input) return;
    return input.subscribe(() => {
      const current = adviceRef.current;
      if (!current) return;
      const diagnostics = input.getDiagnostics();
      if (
        (current.id === 'interaction' && diagnostics.interact) ||
        (current.id === 'boost' && diagnostics.boost)
      ) {
        markSeen(current.id);
      }
    });
  }, [enabled, input, markSeen]);

  useEffect(() => {
    if (advice?.id !== 'objective') return;
    const timeout = window.setTimeout(
      () => markSeen('objective'),
      OBJECTIVE_PREVIEW_MILLISECONDS,
    );
    return () => window.clearTimeout(timeout);
  }, [advice?.id, markSeen]);

  const dismiss = useCallback(() => {
    if (adviceRef.current) markSeen(adviceRef.current.id);
  }, [markSeen]);

  const openJournal = useCallback(() => {
    markSeen('journal');
    useGameStore.getState().requestStoryLog('transmissions');
  }, [markSeen]);

  return { advice, dismiss, openJournal };
}

interface ContextualAdviceOverlayProps {
  advice: ContextualAdvice;
  onDismiss: () => void;
  onOpenJournal: () => void;
}

export function ContextualAdviceOverlay({
  advice,
  onDismiss,
  onOpenJournal,
}: ContextualAdviceOverlayProps) {
  return (
    <aside
      className={`contextual-advice contextual-advice--${advice.id}`}
      aria-live="polite"
      data-contextual-advice={advice.id}
    >
      <div>
        <strong>{advice.title}</strong>
        <span>{advice.message}</span>
      </div>
      {advice.actionLabel && (
        <button type="button" onClick={onOpenJournal}>
          {advice.actionLabel}
        </button>
      )}
      <button
        type="button"
        className="contextual-advice__dismiss"
        aria-label="Ocultar consejo"
        onClick={onDismiss}
      >
        ×
      </button>
    </aside>
  );
}

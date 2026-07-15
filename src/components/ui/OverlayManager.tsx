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

interface OverlayManagerProps {
  allowDiscovery?: boolean;
  allowStory?: boolean;
}

export function OverlayManager({
  allowDiscovery = true,
  allowStory = true,
}: OverlayManagerProps) {
  const recoveryReason = useGameStore((state) => state.recoveryReason);
  const missionChoiceId = useGameStore(
    (state) => state.activeMissionChoiceObjectiveId,
  );
  const narrativeId = useGameStore((state) => state.activeNarrativeEventId);
  const radioId = useGameStore((state) => state.activeRadioEventId);
  const discoveryId = useGameStore((state) => state.lastDiscoveredLocationId);
  const presentationMode = useGameStore((state) => state.presentationMode);
  const discoveryCanUseLargeOverlay =
    presentationMode === 'stopped' || presentationMode === 'interaction';
  const candidates: OverlayCandidate[] = [];
  if (recoveryReason) {
    candidates.push({
      id: `recovery:${recoveryReason}`,
      kind: 'recovery',
      priority: 'critical',
      large: true,
      sequence: 0,
    });
  }
  if (missionChoiceId) {
    candidates.push({
      id: `mission-choice:${missionChoiceId}`,
      kind: 'mission-choice',
      priority: 'critical',
      large: true,
      sequence: 1,
    });
  }
  if (allowStory && narrativeId) {
    candidates.push({
      id: `narrative:${narrativeId}`,
      kind: 'narrative',
      priority: 'narrative',
      large: true,
      sequence: 2,
    });
  }
  if (allowStory && radioId) {
    candidates.push({
      id: `radio:${radioId}`,
      kind: 'radio',
      priority: 'radio',
      large: true,
      sequence: 3,
    });
  }
  if (allowDiscovery && discoveryId) {
    candidates.push({
      id: `discovery:${discoveryId}`,
      kind: 'discovery',
      priority: 'discovery',
      large: discoveryCanUseLargeOverlay,
      sequence: 4,
    });
  }
  const queue = resolveOverlayQueue(candidates);
  const activeKind = queue.activeLarge?.kind ?? null;
  const discoveryCompact = queue.compact.some(
    (candidate) => candidate.kind === 'discovery',
  );
  const renderLargeOverlay = (kind: OverlayKind | null) => {
    switch (kind) {
      case 'recovery':
        return <VehicleRecoveryDialog />;
      case 'mission-choice':
        return <MissionChoiceDialog />;
      case 'narrative':
        return <NarrativeDialog />;
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
      {discoveryCompact && <DiscoveryToast compact />}
    </div>
  );
}

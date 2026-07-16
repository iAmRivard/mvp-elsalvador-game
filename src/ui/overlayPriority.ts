export type OverlayPriority =
  | 'narrative'
  | 'critical'
  | 'interaction'
  | 'tutorial'
  | 'radio'
  | 'information'
  | 'compact-radio'
  | 'discovery';

export type OverlayKind =
  | 'recovery'
  | 'mission-choice'
  | 'narrative'
  | 'tutorial'
  | 'radio'
  | 'contextual-advice'
  | 'discovery';

export interface OverlayCandidate {
  id: string;
  kind: OverlayKind;
  priority: OverlayPriority;
  large: boolean;
  sequence: number;
}

export interface OverlayQueueResolution {
  activeLarge: OverlayCandidate | null;
  queuedLarge: OverlayCandidate[];
  compact: OverlayCandidate[];
}

const priorityOrder: Readonly<Record<OverlayPriority, number>> = {
  narrative: 0,
  critical: 1,
  interaction: 2,
  tutorial: 3,
  radio: 4,
  information: 5,
  'compact-radio': 6,
  discovery: 7,
};

export function resolveOverlayQueue(
  candidates: readonly OverlayCandidate[],
): OverlayQueueResolution {
  const ordered = [...candidates].sort(
    (left, right) =>
      priorityOrder[left.priority] - priorityOrder[right.priority] ||
      left.sequence - right.sequence ||
      left.id.localeCompare(right.id),
  );
  const large = ordered.filter((candidate) => candidate.large);
  const activeLarge = large[0] ?? null;
  const compact = ordered.filter(
    (candidate) =>
      !candidate.large ||
      (activeLarge?.kind === 'radio' && candidate.kind === 'discovery'),
  );
  const compactIds = new Set(compact.map((candidate) => candidate.id));
  return {
    activeLarge,
    queuedLarge: activeLarge
      ? large.slice(1).filter((candidate) => !compactIds.has(candidate.id))
      : [],
    compact,
  };
}

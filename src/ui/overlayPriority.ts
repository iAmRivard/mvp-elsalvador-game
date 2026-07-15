export type OverlayPriority =
  'critical' | 'narrative' | 'radio' | 'discovery' | 'information';

export type OverlayKind =
  'recovery' | 'mission-choice' | 'narrative' | 'radio' | 'discovery';

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
  critical: 0,
  narrative: 1,
  radio: 2,
  discovery: 3,
  information: 4,
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
  return {
    activeLarge,
    queuedLarge: activeLarge ? large.slice(1) : [],
    compact: ordered.filter(
      (candidate) =>
        !candidate.large ||
        (activeLarge?.kind === 'radio' && candidate.kind === 'discovery'),
    ),
  };
}

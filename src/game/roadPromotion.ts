export const lateRoadPromotionAssistRampMilliseconds = 1_500;

export function advanceRoadAssistActiveElapsedMilliseconds(
  elapsedMilliseconds: number,
  lastActiveTimestampMilliseconds: number | null,
  nowMilliseconds: number,
  maximumStepMilliseconds: number,
): number {
  if (
    lastActiveTimestampMilliseconds === null ||
    !Number.isFinite(nowMilliseconds)
  ) {
    return Math.max(0, elapsedMilliseconds);
  }
  const step = Math.min(
    Math.max(0, maximumStepMilliseconds),
    Math.max(0, nowMilliseconds - lastActiveTimestampMilliseconds),
  );
  return Math.max(0, elapsedMilliseconds) + step;
}

export function roadAssistMultiplierForLatePromotion(
  startedAtMilliseconds: number | null,
  nowMilliseconds: number,
  durationMilliseconds = lateRoadPromotionAssistRampMilliseconds,
): number {
  if (startedAtMilliseconds === null) return 1;
  if (!Number.isFinite(nowMilliseconds)) return 0;
  const duration = Math.max(1, durationMilliseconds);
  return Math.min(
    1,
    Math.max(0, (nowMilliseconds - startedAtMilliseconds) / duration),
  );
}

import { normalizeHeading } from '../game/movement';

function headingDistance(left: number, right: number): number {
  return Math.abs(((normalizeHeading(right - left) + 180) % 360) - 180);
}

export function alignedRoadHeading(
  playerHeading: number,
  roadHeading: number,
  oneWay: boolean,
): number {
  const forward = normalizeHeading(roadHeading);
  if (oneWay) return forward;
  const reverse = normalizeHeading(roadHeading + 180);
  return headingDistance(playerHeading, forward) <=
    headingDistance(playerHeading, reverse)
    ? forward
    : reverse;
}

import { routingConfig } from '../config/routing.config';
import { distanceBetweenMeters } from '../game/discovery';
import type { RouteHeadingResult } from '../types/navigation';
import type { RoadCoordinates } from '../types/roads';

const LOCAL_SEGMENTS_BEHIND = 2;
const LOCAL_SEGMENTS_AHEAD = 10;
const LOCAL_SEARCH_MAXIMUM_DISTANCE_METERS = 180;
const LOOK_AHEAD_DISTANCE_METERS = 32;

export interface RouteSegmentProjection {
  coordinates: RoadCoordinates;
  distanceMeters: number;
  progress: number;
}

interface HeadingCandidate {
  projection: RouteSegmentProjection;
  segmentIndex: number;
  score: number;
}

export function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function signedHeadingDifference(from: number, to: number): number {
  return ((normalizeHeading(to - from) + 540) % 360) - 180;
}

export function routeBearing(
  start: RoadCoordinates,
  end: RoadCoordinates,
): number {
  const latitude = ((start[1] + end[1]) / 2) * (Math.PI / 180);
  const east = (end[0] - start[0]) * Math.cos(latitude);
  const north = end[1] - start[1];
  return normalizeHeading((Math.atan2(east, north) * 180) / Math.PI);
}

export function projectOntoRouteSegment(
  point: RoadCoordinates,
  start: RoadCoordinates,
  end: RoadCoordinates,
): RouteSegmentProjection {
  const longitudeScale = 111_320 * Math.cos((point[1] * Math.PI) / 180);
  const latitudeScale = 111_132;
  const startX = (start[0] - point[0]) * longitudeScale;
  const startY = (start[1] - point[1]) * latitudeScale;
  const endX = (end[0] - point[0]) * longitudeScale;
  const endY = (end[1] - point[1]) * latitudeScale;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const progress =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared),
        );
  return {
    coordinates: [
      start[0] + (end[0] - start[0]) * progress,
      start[1] + (end[1] - start[1]) * progress,
    ],
    distanceMeters: Math.hypot(
      startX + deltaX * progress,
      startY + deltaY * progress,
    ),
    progress,
  };
}

function candidateForSegment(
  point: RoadCoordinates,
  playerHeading: number,
  route: readonly RoadCoordinates[],
  segmentIndex: number,
  lastKnownSegmentIndex: number | null,
): HeadingCandidate {
  const projection = projectOntoRouteSegment(
    point,
    route[segmentIndex],
    route[segmentIndex + 1],
  );
  const segmentHeading = routeBearing(
    route[segmentIndex],
    route[segmentIndex + 1],
  );
  const headingPenalty =
    Math.abs(signedHeadingDifference(playerHeading, segmentHeading)) * 0.035;
  const continuityPenalty =
    lastKnownSegmentIndex === null
      ? 0
      : segmentIndex < lastKnownSegmentIndex - 1
        ? 120 + (lastKnownSegmentIndex - segmentIndex) * 24
        : Math.abs(segmentIndex - lastKnownSegmentIndex) * 5;
  const completedSegmentPenalty =
    lastKnownSegmentIndex !== null &&
    segmentIndex < lastKnownSegmentIndex &&
    projection.progress > 0.96
      ? 45
      : 0;
  return {
    projection,
    segmentIndex,
    score:
      projection.distanceMeters +
      headingPenalty +
      continuityPenalty +
      completedSegmentPenalty,
  };
}

function bestCandidate(
  point: RoadCoordinates,
  playerHeading: number,
  route: readonly RoadCoordinates[],
  indices: readonly number[],
  lastKnownSegmentIndex: number | null,
): HeadingCandidate | null {
  let best: HeadingCandidate | null = null;
  for (const segmentIndex of indices) {
    const candidate = candidateForSegment(
      point,
      playerHeading,
      route,
      segmentIndex,
      lastKnownSegmentIndex,
    );
    if (!best || candidate.score < best.score) best = candidate;
  }
  return best;
}

function segmentIndices(
  route: readonly RoadCoordinates[],
  lastKnownSegmentIndex: number | null,
): number[] {
  const finalSegmentIndex = route.length - 2;
  if (lastKnownSegmentIndex === null) {
    return Array.from({ length: finalSegmentIndex + 1 }, (_, index) => index);
  }
  const first = Math.max(0, lastKnownSegmentIndex - LOCAL_SEGMENTS_BEHIND);
  const last = Math.min(
    finalSegmentIndex,
    lastKnownSegmentIndex + LOCAL_SEGMENTS_AHEAD,
  );
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function coordinateAhead(
  route: readonly RoadCoordinates[],
  candidate: HeadingCandidate,
): RoadCoordinates {
  let current = candidate.projection.coordinates;
  let remaining = LOOK_AHEAD_DISTANCE_METERS;
  for (
    let routeIndex = candidate.segmentIndex + 1;
    routeIndex < route.length;
    routeIndex += 1
  ) {
    const next = route[routeIndex];
    const distance = distanceBetweenMeters(current, next);
    if (distance >= remaining && distance > 0) {
      const ratio = remaining / distance;
      return [
        current[0] + (next[0] - current[0]) * ratio,
        current[1] + (next[1] - current[1]) * ratio,
      ];
    }
    remaining -= distance;
    current = next;
  }
  return route.at(-1) ?? candidate.projection.coordinates;
}

export function recommendedRouteHeading(
  playerCoordinates: RoadCoordinates,
  playerHeading: number,
  routeCoordinates: readonly RoadCoordinates[],
  lastKnownSegmentIndex: number | null,
): RouteHeadingResult | null {
  if (routeCoordinates.length < 2) return null;
  const normalizedLast =
    lastKnownSegmentIndex === null
      ? null
      : Math.max(
          0,
          Math.min(routeCoordinates.length - 2, lastKnownSegmentIndex),
        );
  const local = bestCandidate(
    playerCoordinates,
    playerHeading,
    routeCoordinates,
    segmentIndices(routeCoordinates, normalizedLast),
    normalizedLast,
  );
  const global =
    !local ||
    local.projection.distanceMeters > LOCAL_SEARCH_MAXIMUM_DISTANCE_METERS
      ? bestCandidate(
          playerCoordinates,
          playerHeading,
          routeCoordinates,
          segmentIndices(routeCoordinates, null),
          null,
        )
      : null;
  let selected = global ?? local;
  if (!selected) return null;

  if (normalizedLast !== null && selected.segmentIndex !== normalizedLast) {
    const previous = candidateForSegment(
      playerCoordinates,
      playerHeading,
      routeCoordinates,
      normalizedLast,
      normalizedLast,
    );
    if (
      previous.projection.distanceMeters <=
        selected.projection.distanceMeters + 8 &&
      selected.segmentIndex <= normalizedLast + 1
    ) {
      selected = previous;
    }
  }

  const requiresRejoin =
    selected.projection.distanceMeters >
    routingConfig.routeRejoinDistanceMeters;
  const headingTarget = requiresRejoin
    ? selected.projection.coordinates
    : coordinateAhead(routeCoordinates, selected);
  const headingOrigin = requiresRejoin
    ? playerCoordinates
    : selected.projection.coordinates;
  const heading =
    distanceBetweenMeters(headingOrigin, headingTarget) < 1
      ? routeBearing(
          routeCoordinates[selected.segmentIndex],
          routeCoordinates[selected.segmentIndex + 1],
        )
      : routeBearing(headingOrigin, headingTarget);

  return {
    heading,
    segmentIndex: selected.segmentIndex,
    distanceToSegmentMeters: selected.projection.distanceMeters,
    requiresRejoin,
  };
}

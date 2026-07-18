import { restrictedAreaTypeAt } from '../data/restrictedAreas';
import { getRouteRejoinRoadSource } from '../roads/routeRejoinRoadSource';
import type { RoadCoordinates, RoadSurface } from '../types/roads';

export const routeRejoinConfig = {
  maximumDistanceMeters: 120,
  stoppedSpeedKilometersPerHour: 1,
} as const;

export interface RouteRejoinCandidate {
  edgeId: number;
  coordinates: RoadCoordinates;
  distanceMeters: number;
  heading: number;
  oneWay: boolean;
  restricted: boolean;
}

export type RouteRejoinBlockReason =
  | 'game-inactive'
  | 'road-network-unavailable'
  | 'not-offroad'
  | 'moving'
  | 'blocking-overlay'
  | 'restricted-origin'
  | 'offroad-objective'
  | 'no-road'
  | 'road-too-far'
  | 'closed-road'
  | 'restricted-destination';

export interface RouteRejoinObservation {
  gameActive: boolean;
  roadNetworkReady: boolean;
  surface: RoadSurface;
  speedKilometersPerHour: number;
  paused: boolean;
  journalOpen: boolean;
  recoveryActive: boolean;
  narrativeActive: boolean;
  choiceActive: boolean;
  originRestricted: boolean;
  insideExplicitOffroadObjective: boolean;
  routeStatus: 'idle' | 'calculating' | 'road' | 'fallback';
  temporarilyClosedEdgeIds: readonly number[];
  candidates: readonly RouteRejoinCandidate[];
}

export function routeRejoinCandidatesNear(
  position: RoadCoordinates,
): RouteRejoinCandidate[] {
  const source = getRouteRejoinRoadSource();
  if (!source) return [];
  return source.index
    .findRoadCandidates(position, routeRejoinConfig.maximumDistanceMeters)
    .flatMap((nearest) => {
      const edge = source.edgesById.get(nearest.edgeId);
      if (!edge) return [];
      return [
        {
          edgeId: nearest.edgeId,
          coordinates: nearest.coordinates,
          distanceMeters: nearest.distanceMeters,
          heading: nearest.heading,
          oneWay: edge.oneWay,
          restricted: restrictedAreaTypeAt(nearest.coordinates) !== null,
        },
      ];
    });
}

export type RouteRejoinEligibility =
  | {
      eligible: true;
      blockedBy: null;
      candidate: RouteRejoinCandidate;
    }
  | {
      eligible: false;
      blockedBy: RouteRejoinBlockReason;
      candidate: null;
    };

function blocked(blockedBy: RouteRejoinBlockReason): RouteRejoinEligibility {
  return { eligible: false, blockedBy, candidate: null };
}

export function routeRejoinEligibilityFor(
  observation: RouteRejoinObservation,
): RouteRejoinEligibility {
  if (!observation.gameActive) return blocked('game-inactive');
  if (!observation.roadNetworkReady) {
    return blocked('road-network-unavailable');
  }
  if (observation.surface !== 'offroad') return blocked('not-offroad');
  if (
    Math.abs(observation.speedKilometersPerHour) >
    routeRejoinConfig.stoppedSpeedKilometersPerHour
  ) {
    return blocked('moving');
  }
  if (
    observation.paused ||
    observation.journalOpen ||
    observation.recoveryActive ||
    observation.narrativeActive ||
    observation.choiceActive
  ) {
    return blocked('blocking-overlay');
  }
  if (observation.originRestricted) return blocked('restricted-origin');
  if (observation.insideExplicitOffroadObjective) {
    return blocked('offroad-objective');
  }
  if (observation.candidates.length === 0) return blocked('no-road');

  const inRange = observation.candidates.filter(
    (candidate) =>
      candidate.distanceMeters <= routeRejoinConfig.maximumDistanceMeters,
  );
  if (inRange.length === 0) return blocked('road-too-far');
  const open = inRange.filter(
    (candidate) =>
      !observation.temporarilyClosedEdgeIds.includes(candidate.edgeId),
  );
  if (open.length === 0) return blocked('closed-road');
  const safe = open.filter((candidate) => !candidate.restricted);
  if (safe.length === 0) return blocked('restricted-destination');
  const candidate = [...safe].sort(
    (left, right) => left.distanceMeters - right.distanceMeters,
  )[0];
  return { eligible: true, blockedBy: null, candidate };
}

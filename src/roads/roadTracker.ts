import {
  mobileRoadContactConfig,
  roadAssistConfig,
  roadSurfaceForEdge,
} from '../config/roadHandling.config';
import type {
  RoadContact,
  RoadCoordinates,
  RoadEdge,
  RoadSurface,
} from '../types/roads';
import {
  roadResultForEdge,
  type RoadSearchMetrics,
  type RoadSpatialIndex,
} from './spatialIndex';

export interface RoadTrackerContext {
  heading?: number;
  activeRouteEdgeIds?: ReadonlySet<number>;
  mobile?: boolean;
  timestampMilliseconds?: number;
}

export interface RoadContactMemory {
  lastEdgeId: number | null;
  lastSurface: RoadSurface;
  lastValidContactAt: number;
  consecutiveMisses: number;
}

export type RoadContactSource = 'direct' | 'last-edge' | 'grace' | 'offroad';

export type RoadOffroadReason =
  | 'contact-timeout'
  | 'maximum-misses'
  | 'last-edge-too-far'
  | 'no-nearby-edge'
  | null;

export interface RoadSurfaceTransition {
  at: number;
  coordinates: RoadCoordinates;
  from: RoadSurface;
  to: RoadSurface;
  reason: string;
}

export interface RoadCandidateScore {
  distanceScore: number;
  headingScore: number;
  continuityScore: number;
  activeRouteScore: number;
  previousEdgeScore: number;
  roadClassScore: number;
  totalScore: number;
}

export interface ScoredRoadCandidate {
  edgeId: number;
  distanceMeters: number;
  score: RoadCandidateScore;
}

export interface RoadTrackerDiagnostics {
  selectedEdgeId: number | null;
  previousEdgeId: number | null;
  selectedScore: number | null;
  nearestEdgeDistanceMeters: number | null;
  surface: RoadSurface;
  consecutiveMisses: number;
  gracePeriodRemainingMilliseconds: number;
  offroadReason: RoadOffroadReason;
  contactSource: RoadContactSource;
  surfaceHistory: readonly RoadSurfaceTransition[];
  candidates: readonly ScoredRoadCandidate[];
}

export interface RoadTrackerDiagnosticExport {
  coordinates: RoadCoordinates;
  surface: RoadSurface;
  nearestEdgeDistance: number | null;
  lastEdgeId: number | null;
  consecutiveMisses: number;
  gracePeriodRemainingMilliseconds: number;
  reason: RoadOffroadReason;
}

const ROAD_CLASS_SCORES = {
  motorway: 6,
  trunk: 5.5,
  primary: 5,
  secondary: 4,
  tertiary: 3,
  residential: 2,
  service: 1,
  track: 0,
} as const;

const MINIMUM_SCORE_IMPROVEMENT_TO_SWITCH = 3;

function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360;
}

function headingDifference(left: number, right: number): number {
  return Math.abs(((normalizeHeading(right - left) + 180) % 360) - 180);
}

function edgesAreConnected(left: RoadEdge, right: RoadEdge): boolean {
  return (
    left.from === right.from ||
    left.from === right.to ||
    left.to === right.from ||
    left.to === right.to
  );
}

function scoreHeading(
  playerHeading: number | undefined,
  roadHeading: number,
  oneWay: boolean,
): number {
  if (playerHeading === undefined || !Number.isFinite(playerHeading)) return 0;
  const forwardDifference = headingDifference(playerHeading, roadHeading);
  if (oneWay) {
    return forwardDifference <= 90
      ? 24 * (1 - forwardDifference / 90)
      : -36 * ((forwardDifference - 90) / 90);
  }
  const compatibleDifference = Math.min(
    forwardDifference,
    headingDifference(playerHeading, roadHeading + 180),
  );
  return 24 * (1 - compatibleDifference / 90);
}

export class RoadTracker {
  private readonly edgesById: ReadonlyMap<number, RoadEdge>;
  private activeEdgeId: number | null = null;
  private previousEdgeId: number | null = null;
  private contactMemory: RoadContactMemory = {
    lastEdgeId: null,
    lastSurface: 'offroad',
    lastValidContactAt: 0,
    consecutiveMisses: 0,
  };
  private lastMissTimestamp: number | null = null;
  private currentSurface: RoadSurface = 'offroad';
  private lastPosition: RoadCoordinates = [0, 0];
  private readonly surfaceHistory: RoadSurfaceTransition[] = [];
  private diagnostics: RoadTrackerDiagnostics = {
    selectedEdgeId: null,
    previousEdgeId: null,
    selectedScore: null,
    nearestEdgeDistanceMeters: null,
    surface: 'offroad',
    consecutiveMisses: 0,
    gracePeriodRemainingMilliseconds: 0,
    offroadReason: null,
    contactSource: 'offroad',
    surfaceHistory: [],
    candidates: [],
  };

  constructor(private readonly index: RoadSpatialIndex) {
    this.edgesById = new Map(
      index.network.edges.map((edge) => [edge.id, edge]),
    );
  }

  update(
    position: RoadCoordinates,
    context: RoadTrackerContext = {},
  ): RoadContact | null {
    const now =
      context.timestampMilliseconds ??
      (typeof performance === 'undefined' ? Date.now() : performance.now());
    this.lastPosition = [...position];
    const detectionRadiusMeters = context.mobile
      ? mobileRoadContactConfig.detectionRadiusMeters
      : roadAssistConfig.detectionRadiusMeters;
    const nearestCandidates = this.index.findRoadCandidates(
      position,
      detectionRadiusMeters,
    );
    const activeEdge =
      this.activeEdgeId === null
        ? null
        : (this.edgesById.get(this.activeEdgeId) ?? null);
    const scoredCandidates = nearestCandidates.flatMap((nearest) => {
      const edge = this.edgesById.get(nearest.edgeId);
      if (!edge) return [];
      const distanceScore =
        40 *
        Math.max(
          0,
          1 - nearest.distanceMeters / detectionRadiusMeters,
        );
      const headingScore = scoreHeading(
        context.heading,
        nearest.heading,
        edge.oneWay,
      );
      const continuityScore =
        activeEdge && edge.id !== activeEdge.id
          ? edgesAreConnected(activeEdge, edge)
            ? 8
            : -18
          : 0;
      const activeRouteScore = context.activeRouteEdgeIds?.size
        ? context.activeRouteEdgeIds.has(edge.id)
          ? 35
          : -10
        : 0;
      const previousEdgeScore = edge.id === activeEdge?.id ? 10 : 0;
      const roadClassScore = ROAD_CLASS_SCORES[edge.roadClass];
      const score: RoadCandidateScore = {
        distanceScore,
        headingScore,
        continuityScore,
        activeRouteScore,
        previousEdgeScore,
        roadClassScore,
        totalScore:
          distanceScore +
          headingScore +
          continuityScore +
          activeRouteScore +
          previousEdgeScore +
          roadClassScore,
      };
      return [{ edge, nearest, score }];
    });
    scoredCandidates.sort(
      (left, right) => right.score.totalScore - left.score.totalScore,
    );
    let selected = scoredCandidates[0] ?? null;
    const current = scoredCandidates.find(
      (candidate) => candidate.edge.id === activeEdge?.id,
    );
    if (
      current &&
      selected &&
      selected.edge.id !== current.edge.id &&
      selected.score.totalScore <
        current.score.totalScore + MINIMUM_SCORE_IMPROVEMENT_TO_SWITCH
    ) {
      selected = current;
    }

    const candidates = scoredCandidates.map((candidate) => ({
      edgeId: candidate.edge.id,
      distanceMeters: candidate.nearest.distanceMeters,
      score: candidate.score,
    }));

    if (selected) {
      if (
        this.activeEdgeId !== null &&
        this.activeEdgeId !== selected.edge.id
      ) {
        this.previousEdgeId = this.activeEdgeId;
      }
      const surface = roadSurfaceForEdge(selected.edge);
      this.activeEdgeId = selected.edge.id;
      this.contactMemory = {
        lastEdgeId: selected.edge.id,
        lastSurface: surface,
        lastValidContactAt: now,
        consecutiveMisses: 0,
      };
      this.lastMissTimestamp = null;
      this.recordSurfaceTransition(surface, now, position, 'direct-contact');
      this.diagnostics = {
        selectedEdgeId: selected.edge.id,
        previousEdgeId: this.previousEdgeId,
        selectedScore: selected.score.totalScore,
        nearestEdgeDistanceMeters: selected.nearest.distanceMeters,
        surface,
        consecutiveMisses: 0,
        gracePeriodRemainingMilliseconds:
          mobileRoadContactConfig.gracePeriodMilliseconds,
        offroadReason: null,
        contactSource: 'direct',
        surfaceHistory: [...this.surfaceHistory],
        candidates,
      };
      return {
        edge: selected.edge,
        nearest: selected.nearest,
        surface,
        recovered: false,
      };
    }

    if (this.lastMissTimestamp !== now) {
      this.contactMemory = {
        ...this.contactMemory,
        consecutiveMisses: this.contactMemory.consecutiveMisses + 1,
      };
      this.lastMissTimestamp = now;
    }
    const elapsedSinceValidContact =
      this.contactMemory.lastEdgeId === null
        ? Number.POSITIVE_INFINITY
        : Math.max(0, now - this.contactMemory.lastValidContactAt);
    const gracePeriodRemainingMilliseconds = Math.max(
      0,
      mobileRoadContactConfig.gracePeriodMilliseconds -
        elapsedSinceValidContact,
    );
    const lastEdge =
      this.contactMemory.lastEdgeId === null
        ? null
        : (this.edgesById.get(this.contactMemory.lastEdgeId) ?? null);
    const lastEdgeResult = lastEdge
      ? roadResultForEdge(position, lastEdge)
      : null;
    const withinGrace =
      lastEdge !== null &&
      lastEdgeResult !== null &&
      elapsedSinceValidContact <=
        mobileRoadContactConfig.gracePeriodMilliseconds &&
      this.contactMemory.consecutiveMisses <
        mobileRoadContactConfig.maximumConsecutiveMisses;

    if (withinGrace && lastEdge && lastEdgeResult) {
      const contactSource: RoadContactSource =
        lastEdgeResult.distanceMeters <=
        mobileRoadContactConfig.lastEdgeSearchRadiusMeters
          ? 'last-edge'
          : 'grace';
      this.activeEdgeId = lastEdge.id;
      this.recordSurfaceTransition(
        'road-unclassified',
        now,
        position,
        contactSource,
      );
      this.diagnostics = {
        selectedEdgeId: lastEdge.id,
        previousEdgeId: this.previousEdgeId,
        selectedScore: null,
        nearestEdgeDistanceMeters: lastEdgeResult.distanceMeters,
        surface: 'road-unclassified',
        consecutiveMisses: this.contactMemory.consecutiveMisses,
        gracePeriodRemainingMilliseconds,
        offroadReason: null,
        contactSource,
        surfaceHistory: [...this.surfaceHistory],
        candidates,
      };
      return {
        edge: lastEdge,
        nearest: lastEdgeResult,
        surface: 'road-unclassified',
        recovered: true,
      };
    }

    const offroadReason: RoadOffroadReason =
      elapsedSinceValidContact >
      mobileRoadContactConfig.gracePeriodMilliseconds
        ? 'contact-timeout'
        : this.contactMemory.consecutiveMisses >=
            mobileRoadContactConfig.maximumConsecutiveMisses
          ? 'maximum-misses'
          : lastEdgeResult &&
              lastEdgeResult.distanceMeters >
                mobileRoadContactConfig.lastEdgeSearchRadiusMeters
            ? 'last-edge-too-far'
            : 'no-nearby-edge';
    this.activeEdgeId = null;
    this.recordSurfaceTransition('offroad', now, position, offroadReason);
    this.diagnostics = {
      selectedEdgeId: null,
      previousEdgeId: this.previousEdgeId,
      selectedScore: null,
      nearestEdgeDistanceMeters: lastEdgeResult?.distanceMeters ?? null,
      surface: 'offroad',
      consecutiveMisses: this.contactMemory.consecutiveMisses,
      gracePeriodRemainingMilliseconds,
      offroadReason,
      contactSource: 'offroad',
      surfaceHistory: [...this.surfaceHistory],
      candidates,
    };
    return null;
  }

  reset(): void {
    this.activeEdgeId = null;
    this.previousEdgeId = null;
    this.contactMemory = {
      lastEdgeId: null,
      lastSurface: 'offroad',
      lastValidContactAt: 0,
      consecutiveMisses: 0,
    };
    this.lastMissTimestamp = null;
    this.currentSurface = 'offroad';
    this.lastPosition = [0, 0];
    this.surfaceHistory.length = 0;
    this.diagnostics = {
      selectedEdgeId: null,
      previousEdgeId: null,
      selectedScore: null,
      nearestEdgeDistanceMeters: null,
      surface: 'offroad',
      consecutiveMisses: 0,
      gracePeriodRemainingMilliseconds: 0,
      offroadReason: null,
      contactSource: 'offroad',
      surfaceHistory: [],
      candidates: [],
    };
  }

  getMetrics(): RoadSearchMetrics {
    return this.index.getMetrics();
  }

  getDiagnostics(): RoadTrackerDiagnostics {
    return this.diagnostics;
  }

  getContactMemory(): RoadContactMemory {
    return { ...this.contactMemory };
  }

  getDiagnosticExport(): RoadTrackerDiagnosticExport {
    return {
      coordinates: [...this.lastPosition],
      surface: this.diagnostics.surface,
      nearestEdgeDistance: this.diagnostics.nearestEdgeDistanceMeters,
      lastEdgeId: this.contactMemory.lastEdgeId,
      consecutiveMisses: this.contactMemory.consecutiveMisses,
      gracePeriodRemainingMilliseconds:
        this.diagnostics.gracePeriodRemainingMilliseconds,
      reason: this.diagnostics.offroadReason,
    };
  }

  private recordSurfaceTransition(
    surface: RoadSurface,
    at: number,
    coordinates: RoadCoordinates,
    reason: string,
  ): void {
    if (surface === this.currentSurface) return;
    this.surfaceHistory.push({
      at,
      coordinates: [...coordinates],
      from: this.currentSurface,
      to: surface,
      reason,
    });
    if (
      this.surfaceHistory.length > mobileRoadContactConfig.surfaceHistoryLimit
    ) {
      this.surfaceHistory.splice(
        0,
        this.surfaceHistory.length -
          mobileRoadContactConfig.surfaceHistoryLimit,
      );
    }
    this.currentSurface = surface;
  }
}

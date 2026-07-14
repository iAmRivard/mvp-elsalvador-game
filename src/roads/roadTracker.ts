import { roadAssistConfig } from '../config/roadHandling.config';
import type { RoadContact, RoadCoordinates, RoadEdge } from '../types/roads';
import { type RoadSearchMetrics, type RoadSpatialIndex } from './spatialIndex';

export interface RoadTrackerContext {
  heading?: number;
  activeRouteEdgeIds?: ReadonlySet<number>;
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
  selectedScore: number | null;
  candidates: readonly ScoredRoadCandidate[];
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
  private diagnostics: RoadTrackerDiagnostics = {
    selectedEdgeId: null,
    selectedScore: null,
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
    const nearestCandidates = this.index.findRoadCandidates(
      position,
      roadAssistConfig.disengageDistanceMeters,
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
          1 - nearest.distanceMeters / roadAssistConfig.disengageDistanceMeters,
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

    this.diagnostics = {
      selectedEdgeId: selected?.edge.id ?? null,
      selectedScore: selected?.score.totalScore ?? null,
      candidates: scoredCandidates.map((candidate) => ({
        edgeId: candidate.edge.id,
        distanceMeters: candidate.nearest.distanceMeters,
        score: candidate.score,
      })),
    };

    if (!selected) {
      this.activeEdgeId = null;
      return null;
    }
    this.activeEdgeId = selected.edge.id;
    return { edge: selected.edge, nearest: selected.nearest };
  }

  reset(): void {
    this.activeEdgeId = null;
    this.diagnostics = {
      selectedEdgeId: null,
      selectedScore: null,
      candidates: [],
    };
  }

  getMetrics(): RoadSearchMetrics {
    return this.index.getMetrics();
  }

  getDiagnostics(): RoadTrackerDiagnostics {
    return this.diagnostics;
  }
}

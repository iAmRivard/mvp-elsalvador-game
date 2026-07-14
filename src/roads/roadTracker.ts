import { roadAssistConfig } from '../config/roadHandling.config';
import type { RoadContact, RoadCoordinates, RoadEdge } from '../types/roads';
import {
  roadResultForEdge,
  type RoadSearchMetrics,
  type RoadSpatialIndex,
} from './spatialIndex';

export class RoadTracker {
  private readonly edgesById: ReadonlyMap<number, RoadEdge>;
  private activeEdgeId: number | null = null;

  constructor(private readonly index: RoadSpatialIndex) {
    this.edgesById = new Map(
      index.network.edges.map((edge) => [edge.id, edge]),
    );
  }

  update(position: RoadCoordinates): RoadContact | null {
    const candidate = this.index.findNearestRoad(
      position,
      roadAssistConfig.disengageDistanceMeters,
    );
    const activeEdge =
      this.activeEdgeId === null
        ? null
        : (this.edgesById.get(this.activeEdgeId) ?? null);
    const activeNearest = activeEdge
      ? roadResultForEdge(position, activeEdge)
      : null;

    if (
      activeEdge &&
      activeNearest &&
      activeNearest.distanceMeters <=
        roadAssistConfig.disengageDistanceMeters &&
      (!candidate ||
        candidate.edgeId === activeEdge.id ||
        activeNearest.distanceMeters <=
          candidate.distanceMeters +
            roadAssistConfig.edgeSwitchHysteresisMeters)
    ) {
      return { edge: activeEdge, nearest: activeNearest };
    }

    if (!candidate) {
      this.activeEdgeId = null;
      return null;
    }
    const edge = this.edgesById.get(candidate.edgeId);
    if (!edge) {
      this.activeEdgeId = null;
      return null;
    }
    this.activeEdgeId = edge.id;
    return { edge, nearest: candidate };
  }

  reset(): void {
    this.activeEdgeId = null;
  }

  getMetrics(): RoadSearchMetrics {
    return this.index.getMetrics();
  }
}

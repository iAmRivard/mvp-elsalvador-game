import { roadNetworkConfig } from '../config/roads.config';
import type {
  NearestRoadResult,
  RoadCoordinates,
  RoadEdge,
  RoadNetwork,
} from '../types/roads';

interface IndexedRoadSegment {
  edge: RoadEdge;
  segmentIndex: number;
  distanceBeforeSegmentMeters: number;
  segmentDistanceMeters: number;
}

interface SegmentProjection {
  coordinates: RoadCoordinates;
  distanceMeters: number;
  progress: number;
}

export interface RoadSearchMetrics {
  searches: number;
  averageDurationMilliseconds: number;
  lastDurationMilliseconds: number;
  lastCandidateCount: number;
  segmentCount: number;
  cellCount: number;
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function distanceMeters(a: RoadCoordinates, b: RoadCoordinates): number {
  const radians = Math.PI / 180;
  const latitude1 = a[1] * radians;
  const latitude2 = b[1] * radians;
  const deltaLatitude = (b[1] - a[1]) * radians;
  const deltaLongitude = (b[0] - a[0]) * radians;
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) ** 2;
  return (
    6_371_008.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function projectOntoSegment(
  position: RoadCoordinates,
  start: RoadCoordinates,
  end: RoadCoordinates,
): SegmentProjection {
  const latitudeRadians = (position[1] * Math.PI) / 180;
  const longitudeScale = 111_320 * Math.cos(latitudeRadians);
  const latitudeScale = 111_132;
  const endX = (end[0] - start[0]) * longitudeScale;
  const endY = (end[1] - start[1]) * latitudeScale;
  const positionX = (position[0] - start[0]) * longitudeScale;
  const positionY = (position[1] - start[1]) * latitudeScale;
  const segmentLengthSquared = endX * endX + endY * endY;
  const progress =
    segmentLengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            (positionX * endX + positionY * endY) / segmentLengthSquared,
          ),
        );
  const coordinates: RoadCoordinates = [
    start[0] + (end[0] - start[0]) * progress,
    start[1] + (end[1] - start[1]) * progress,
  ];
  return {
    coordinates,
    distanceMeters: Math.hypot(
      positionX - endX * progress,
      positionY - endY * progress,
    ),
    progress,
  };
}

function segmentHeading(start: RoadCoordinates, end: RoadCoordinates): number {
  const latitude = ((start[1] + end[1]) / 2) * (Math.PI / 180);
  const east = (end[0] - start[0]) * Math.cos(latitude);
  const north = end[1] - start[1];
  return (Math.atan2(east, north) * 180) / Math.PI;
}

export function projectPositionOntoRoad(
  position: RoadCoordinates,
  edge: RoadEdge,
): RoadCoordinates {
  return (
    roadResultForEdge(position, edge)?.coordinates ??
    edge.coordinates[0] ??
    position
  );
}

export function roadResultForEdge(
  position: RoadCoordinates,
  edge: RoadEdge,
): NearestRoadResult | null {
  let nearest: NearestRoadResult | null = null;
  let distanceBeforeSegmentMeters = 0;
  for (let index = 1; index < edge.coordinates.length; index += 1) {
    const start = edge.coordinates[index - 1];
    const end = edge.coordinates[index];
    const segmentDistanceMeters = distanceMeters(start, end);
    const projection = projectOntoSegment(position, start, end);
    if (!nearest || projection.distanceMeters < nearest.distanceMeters) {
      const traveled =
        distanceBeforeSegmentMeters +
        projection.progress * segmentDistanceMeters;
      nearest = {
        edgeId: edge.id,
        coordinates: projection.coordinates,
        distanceMeters: projection.distanceMeters,
        progress: Math.max(0, Math.min(1, traveled / edge.distanceMeters)),
        roadClass: edge.roadClass,
        speedMultiplier: edge.speedMultiplier,
        heading: segmentHeading(start, end),
      };
    }
    distanceBeforeSegmentMeters += segmentDistanceMeters;
  }
  return nearest;
}

export class RoadSpatialIndex {
  readonly network: RoadNetwork;
  readonly cellSizeDegrees: number;
  private readonly cells = new Map<string, IndexedRoadSegment[]>();
  private searches = 0;
  private totalSearchDurationMilliseconds = 0;
  private lastSearchDurationMilliseconds = 0;
  private lastCandidateCount = 0;
  private segmentCount = 0;

  constructor(
    network: RoadNetwork,
    cellSizeDegrees: number = roadNetworkConfig.spatialCellSizeDegrees,
  ) {
    this.network = network;
    this.cellSizeDegrees = cellSizeDegrees;
    this.build();
  }

  private cellCoordinate(value: number): number {
    return Math.floor(value / this.cellSizeDegrees);
  }

  private cellKey(longitudeCell: number, latitudeCell: number): string {
    return `${longitudeCell}:${latitudeCell}`;
  }

  private build(): void {
    for (const edge of this.network.edges) {
      let distanceBeforeSegmentMeters = 0;
      for (
        let segmentIndex = 1;
        segmentIndex < edge.coordinates.length;
        segmentIndex += 1
      ) {
        const start = edge.coordinates[segmentIndex - 1];
        const end = edge.coordinates[segmentIndex];
        const segmentDistanceMeters = distanceMeters(start, end);
        const segment: IndexedRoadSegment = {
          edge,
          segmentIndex,
          distanceBeforeSegmentMeters,
          segmentDistanceMeters,
        };
        const minimumLongitudeCell = this.cellCoordinate(
          Math.min(start[0], end[0]),
        );
        const maximumLongitudeCell = this.cellCoordinate(
          Math.max(start[0], end[0]),
        );
        const minimumLatitudeCell = this.cellCoordinate(
          Math.min(start[1], end[1]),
        );
        const maximumLatitudeCell = this.cellCoordinate(
          Math.max(start[1], end[1]),
        );
        for (
          let longitudeCell = minimumLongitudeCell;
          longitudeCell <= maximumLongitudeCell;
          longitudeCell += 1
        ) {
          for (
            let latitudeCell = minimumLatitudeCell;
            latitudeCell <= maximumLatitudeCell;
            latitudeCell += 1
          ) {
            const key = this.cellKey(longitudeCell, latitudeCell);
            const cell = this.cells.get(key) ?? [];
            cell.push(segment);
            this.cells.set(key, cell);
          }
        }
        this.segmentCount += 1;
        distanceBeforeSegmentMeters += segmentDistanceMeters;
      }
    }
  }

  findRoadCandidates(
    position: RoadCoordinates,
    maximumDistanceMeters: number,
  ): NearestRoadResult[] {
    const startedAt = now();
    const latitudeRadius = maximumDistanceMeters / 111_132;
    const longitudeScale = Math.max(
      1,
      111_320 * Math.cos((position[1] * Math.PI) / 180),
    );
    const longitudeRadius = maximumDistanceMeters / longitudeScale;
    const minimumLongitudeCell = this.cellCoordinate(
      position[0] - longitudeRadius,
    );
    const maximumLongitudeCell = this.cellCoordinate(
      position[0] + longitudeRadius,
    );
    const minimumLatitudeCell = this.cellCoordinate(
      position[1] - latitudeRadius,
    );
    const maximumLatitudeCell = this.cellCoordinate(
      position[1] + latitudeRadius,
    );
    const candidates = new Map<string, IndexedRoadSegment>();

    for (
      let longitudeCell = minimumLongitudeCell;
      longitudeCell <= maximumLongitudeCell;
      longitudeCell += 1
    ) {
      for (
        let latitudeCell = minimumLatitudeCell;
        latitudeCell <= maximumLatitudeCell;
        latitudeCell += 1
      ) {
        for (const segment of this.cells.get(
          this.cellKey(longitudeCell, latitudeCell),
        ) ?? []) {
          candidates.set(`${segment.edge.id}:${segment.segmentIndex}`, segment);
        }
      }
    }

    const nearestByEdge = new Map<number, NearestRoadResult>();
    for (const segment of candidates.values()) {
      const start = segment.edge.coordinates[segment.segmentIndex - 1];
      const end = segment.edge.coordinates[segment.segmentIndex];
      const projection = projectOntoSegment(position, start, end);
      const current = nearestByEdge.get(segment.edge.id);
      if (
        projection.distanceMeters > maximumDistanceMeters ||
        (current && projection.distanceMeters >= current.distanceMeters)
      ) {
        continue;
      }
      const traveled =
        segment.distanceBeforeSegmentMeters +
        projection.progress * segment.segmentDistanceMeters;
      nearestByEdge.set(segment.edge.id, {
        edgeId: segment.edge.id,
        coordinates: projection.coordinates,
        distanceMeters: projection.distanceMeters,
        progress: Math.max(
          0,
          Math.min(1, traveled / segment.edge.distanceMeters),
        ),
        roadClass: segment.edge.roadClass,
        speedMultiplier: segment.edge.speedMultiplier,
        heading: segmentHeading(start, end),
      });
    }

    const durationMilliseconds = now() - startedAt;
    this.searches += 1;
    this.lastCandidateCount = candidates.size;
    this.lastSearchDurationMilliseconds = durationMilliseconds;
    this.totalSearchDurationMilliseconds += durationMilliseconds;
    return [...nearestByEdge.values()].sort(
      (left, right) => left.distanceMeters - right.distanceMeters,
    );
  }

  findNearestRoad(
    position: RoadCoordinates,
    maximumDistanceMeters: number,
  ): NearestRoadResult | null {
    return this.findRoadCandidates(position, maximumDistanceMeters)[0] ?? null;
  }

  getMetrics(): RoadSearchMetrics {
    return {
      searches: this.searches,
      averageDurationMilliseconds:
        this.searches === 0
          ? 0
          : this.totalSearchDurationMilliseconds / this.searches,
      lastDurationMilliseconds: this.lastSearchDurationMilliseconds,
      lastCandidateCount: this.lastCandidateCount,
      segmentCount: this.segmentCount,
      cellCount: this.cells.size,
    };
  }
}

let defaultRoadIndex: RoadSpatialIndex | null = null;

export function setDefaultRoadSpatialIndex(
  index: RoadSpatialIndex | null,
): void {
  defaultRoadIndex = index;
}

export function findNearestRoad(
  position: RoadCoordinates,
  maximumDistanceMeters: number,
): NearestRoadResult | null {
  return (
    defaultRoadIndex?.findNearestRoad(position, maximumDistanceMeters) ?? null
  );
}

import { routingConfig } from '../config/routing.config';
import { travelConfig } from '../config/travel.config';
import { distanceBetweenMeters } from '../game/discovery';
import type {
  RouteRequest,
  RouteResult,
  RoutingDiagnostics,
  RoutingService,
} from '../types/routing';
import type {
  NearestRoadResult,
  RoadCoordinates,
  RoadEdge,
  RoadNetwork,
} from '../types/roads';
import { loadRoadNetwork, type LoadedRoadNetwork } from './roadNetwork';
import type { RoadSpatialIndex } from './spatialIndex';

interface GraphArc {
  to: number;
  edge: RoadEdge;
  forward: boolean;
}

interface RouteEndpointCandidate {
  nodeId: number;
  edgeId: number;
  partialEdgeDistanceMeters: number;
  distanceMeters: number;
  cost: number;
  coordinates: RoadCoordinates[];
}

interface CameFromEntry {
  previousNodeId: number;
  arc: GraphArc;
}

interface QueueEntry {
  nodeId: number;
  priority: number;
}

class MinimumQueue {
  private readonly values: QueueEntry[] = [];

  push(value: QueueEntry): void {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].priority <= value.priority) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop(): QueueEntry | null {
    if (this.values.length === 0) return null;
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length === 0 || !last) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const smallest =
        right < this.values.length &&
        this.values[right].priority < this.values[left].priority
          ? right
          : left;
      if (this.values[smallest].priority >= last.priority) break;
      this.values[index] = this.values[smallest];
      index = smallest;
    }
    this.values[index] = last;
    return first;
  }
}

function appendCoordinates(
  target: RoadCoordinates[],
  additions: readonly RoadCoordinates[],
): void {
  for (const coordinate of additions) {
    const previous = target.at(-1);
    if (
      previous &&
      Math.abs(previous[0] - coordinate[0]) < 1e-10 &&
      Math.abs(previous[1] - coordinate[1]) < 1e-10
    ) {
      continue;
    }
    target.push(coordinate);
  }
}

function splitEdgeAtProjection(
  edge: RoadEdge,
  nearest: NearestRoadResult,
): { before: RoadCoordinates[]; after: RoadCoordinates[] } {
  const targetDistance = nearest.progress * edge.distanceMeters;
  let accumulatedDistance = 0;
  for (let index = 1; index < edge.coordinates.length; index += 1) {
    const segmentDistance = distanceBetweenMeters(
      edge.coordinates[index - 1],
      edge.coordinates[index],
    );
    if (
      targetDistance <= accumulatedDistance + segmentDistance + 0.1 ||
      index === edge.coordinates.length - 1
    ) {
      const before = edge.coordinates.slice(0, index);
      appendCoordinates(before, [nearest.coordinates]);
      const after: RoadCoordinates[] = [nearest.coordinates];
      appendCoordinates(after, edge.coordinates.slice(index));
      return { before, after };
    }
    accumulatedDistance += segmentDistance;
  }
  return {
    before: [...edge.coordinates],
    after: [edge.coordinates.at(-1) ?? nearest.coordinates],
  };
}

function retainCheapestCandidates(
  candidates: readonly RouteEndpointCandidate[],
): Map<number, RouteEndpointCandidate> {
  const byNode = new Map<number, RouteEndpointCandidate>();
  for (const candidate of candidates) {
    const current = byNode.get(candidate.nodeId);
    if (!current || candidate.cost < current.cost)
      byNode.set(candidate.nodeId, candidate);
  }
  return byNode;
}

function endpointCandidates(
  position: RoadCoordinates,
  edge: RoadEdge,
  nearest: NearestRoadResult,
  endpoint: 'origin' | 'destination',
): Map<number, RouteEndpointCandidate> {
  const connectorDistance = distanceBetweenMeters(
    position,
    nearest.coordinates,
  );
  const connectorCost = connectorDistance / 0.25;
  const distanceToFrom = nearest.progress * edge.distanceMeters;
  const distanceToTo = (1 - nearest.progress) * edge.distanceMeters;
  const edgeCostMultiplier = 1 / Math.max(0.1, edge.speedMultiplier);
  const { before, after } = splitEdgeAtProjection(edge, nearest);

  if (endpoint === 'origin') {
    const candidates: RouteEndpointCandidate[] = [
      {
        nodeId: edge.to,
        edgeId: edge.id,
        partialEdgeDistanceMeters: distanceToTo,
        distanceMeters: connectorDistance + distanceToTo,
        cost: connectorCost + distanceToTo * edgeCostMultiplier,
        coordinates: [position, ...after],
      },
    ];
    if (!edge.oneWay) {
      candidates.push({
        nodeId: edge.from,
        edgeId: edge.id,
        partialEdgeDistanceMeters: distanceToFrom,
        distanceMeters: connectorDistance + distanceToFrom,
        cost: connectorCost + distanceToFrom * edgeCostMultiplier,
        coordinates: [position, ...[...before].reverse()],
      });
    }
    return retainCheapestCandidates(candidates);
  }

  const candidates: RouteEndpointCandidate[] = [
    {
      nodeId: edge.from,
      edgeId: edge.id,
      partialEdgeDistanceMeters: distanceToFrom,
      distanceMeters: connectorDistance + distanceToFrom,
      cost: connectorCost + distanceToFrom * edgeCostMultiplier,
      coordinates: [...before, position],
    },
  ];
  if (!edge.oneWay) {
    candidates.push({
      nodeId: edge.to,
      edgeId: edge.id,
      partialEdgeDistanceMeters: distanceToTo,
      distanceMeters: connectorDistance + distanceToTo,
      cost: connectorCost + distanceToTo * edgeCostMultiplier,
      coordinates: [...[...after].reverse(), position],
    });
  }
  return retainCheapestCandidates(candidates);
}

function routeDurationSeconds(distanceMeters: number): number {
  const averageVehicleSpeed =
    travelConfig.normalMaximumSpeedMetersPerSecond *
    routingConfig.averageCruisingSpeedRatio;
  return (
    distanceMeters / (travelConfig.geographicTravelScale * averageVehicleSpeed)
  );
}

function cacheKey(request: RouteRequest): string {
  const coordinates = [...request.origin, ...request.destination]
    .map((value) => value.toFixed(5))
    .join(',');
  const blocked = [...(request.blockedEdgeIds ?? [])]
    .sort((a, b) => a - b)
    .join(',');
  const closed = [...(request.temporarilyClosedEdgeIds ?? [])]
    .sort((a, b) => a - b)
    .join(',');
  const penalties = Object.entries(request.edgePenaltyMultipliers ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([edgeId, multiplier]) => `${edgeId}:${String(multiplier)}`)
    .join(',');
  return `${coordinates}|${blocked}|${closed}|${penalties}`;
}

export class AStarRouter {
  private readonly adjacency: GraphArc[][];
  private readonly nodesById: RoadNetwork['nodes'];
  private readonly edgesById: ReadonlyMap<number, RoadEdge>;
  private readonly cache = new Map<string, RouteResult | null>();
  private calculations = 0;
  private cacheHits = 0;
  private totalDurationMilliseconds = 0;
  private lastExpandedNodeCount = 0;

  constructor(
    private readonly network: RoadNetwork,
    private readonly index: RoadSpatialIndex,
  ) {
    this.nodesById = network.nodes;
    this.edgesById = new Map(network.edges.map((edge) => [edge.id, edge]));
    this.adjacency = Array.from({ length: network.nodes.length }, () => []);
    for (const edge of network.edges) {
      this.adjacency[edge.from]?.push({ to: edge.to, edge, forward: true });
      if (!edge.oneWay) {
        this.adjacency[edge.to]?.push({ to: edge.from, edge, forward: false });
      }
    }
  }

  getRoute(request: RouteRequest): RouteResult | null {
    const key = cacheKey(request);
    if (this.cache.has(key)) {
      this.cacheHits += 1;
      return this.cache.get(key) ?? null;
    }
    const startedAt = performance.now();
    const result = this.calculate(request);
    this.calculations += 1;
    this.totalDurationMilliseconds += performance.now() - startedAt;
    this.cache.set(key, result);
    if (this.cache.size > routingConfig.maximumCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    return result;
  }

  private calculate(request: RouteRequest): RouteResult | null {
    const originNearest = this.index.findNearestRoad(
      request.origin,
      routingConfig.maximumSnapDistanceMeters,
    );
    const destinationNearest = this.index.findNearestRoad(
      request.destination,
      routingConfig.maximumSnapDistanceMeters,
    );
    if (!originNearest || !destinationNearest) return null;
    const originEdge = this.edgesById.get(originNearest.edgeId);
    const destinationEdge = this.edgesById.get(destinationNearest.edgeId);
    if (!originEdge || !destinationEdge) return null;

    const starts = endpointCandidates(
      request.origin,
      originEdge,
      originNearest,
      'origin',
    );
    const goals = endpointCandidates(
      request.destination,
      destinationEdge,
      destinationNearest,
      'destination',
    );
    const excluded = new Set([
      ...(request.blockedEdgeIds ?? []),
      ...(request.temporarilyClosedEdgeIds ?? []),
    ]);
    const penalties = request.edgePenaltyMultipliers ?? {};
    const open = new MinimumQueue();
    const costs = new Map<number, number>();
    const distances = new Map<number, number>();
    const cameFrom = new Map<number, CameFromEntry>();
    const heuristic = (nodeId: number) =>
      distanceBetweenMeters(
        this.nodesById[nodeId].coordinates,
        request.destination,
      ) / 1.25;

    for (const start of starts.values()) {
      if (excluded.has(start.edgeId) && start.partialEdgeDistanceMeters > 0.5) {
        continue;
      }
      const current = costs.get(start.nodeId);
      if (current !== undefined && current <= start.cost) continue;
      costs.set(start.nodeId, start.cost);
      distances.set(start.nodeId, start.distanceMeters);
      open.push({
        nodeId: start.nodeId,
        priority: start.cost + heuristic(start.nodeId),
      });
    }

    let bestGoalNodeId: number | null = null;
    let bestGoalCost = Number.POSITIVE_INFINITY;
    let expandedNodeCount = 0;
    while (true) {
      const current = open.pop();
      if (!current) break;
      const currentCost = costs.get(current.nodeId);
      if (currentCost === undefined) continue;
      if (current.priority > currentCost + heuristic(current.nodeId) + 0.001)
        continue;
      if (current.priority >= bestGoalCost) break;
      expandedNodeCount += 1;

      const candidateGoal = goals.get(current.nodeId);
      const goal =
        candidateGoal &&
        (!excluded.has(candidateGoal.edgeId) ||
          candidateGoal.partialEdgeDistanceMeters <= 0.5)
          ? candidateGoal
          : null;
      if (goal && currentCost + goal.cost < bestGoalCost) {
        bestGoalCost = currentCost + goal.cost;
        bestGoalNodeId = current.nodeId;
      }

      for (const arc of this.adjacency[current.nodeId] ?? []) {
        if (excluded.has(arc.edge.id)) continue;
        const penalty = Math.max(1, penalties[arc.edge.id] ?? 1);
        const edgeCost =
          (arc.edge.distanceMeters / Math.max(0.1, arc.edge.speedMultiplier)) *
          penalty;
        const nextCost = currentCost + edgeCost;
        if (nextCost >= (costs.get(arc.to) ?? Number.POSITIVE_INFINITY))
          continue;
        costs.set(arc.to, nextCost);
        distances.set(
          arc.to,
          (distances.get(current.nodeId) ?? 0) + arc.edge.distanceMeters,
        );
        cameFrom.set(arc.to, { previousNodeId: current.nodeId, arc });
        open.push({ nodeId: arc.to, priority: nextCost + heuristic(arc.to) });
      }
    }
    this.lastExpandedNodeCount = expandedNodeCount;
    if (bestGoalNodeId === null) return null;

    const path: GraphArc[] = [];
    let rootNodeId = bestGoalNodeId;
    while (cameFrom.has(rootNodeId)) {
      const entry = cameFrom.get(rootNodeId);
      if (!entry) break;
      path.push(entry.arc);
      rootNodeId = entry.previousNodeId;
    }
    path.reverse();
    const start = starts.get(rootNodeId);
    const goal = goals.get(bestGoalNodeId);
    if (!start || !goal) return null;

    const coordinates: RoadCoordinates[] = [];
    appendCoordinates(coordinates, start.coordinates);
    for (const arc of path) {
      appendCoordinates(
        coordinates,
        arc.forward
          ? arc.edge.coordinates
          : [...arc.edge.coordinates].reverse(),
      );
    }
    appendCoordinates(coordinates, goal.coordinates);
    const distanceMeters =
      (distances.get(bestGoalNodeId) ?? start.distanceMeters) +
      goal.distanceMeters;
    const edgeIds = [
      ...(start.partialEdgeDistanceMeters > 0.5 ? [start.edgeId] : []),
      ...path.map((arc) => arc.edge.id),
      ...(goal.partialEdgeDistanceMeters > 0.5 ? [goal.edgeId] : []),
    ].filter(
      (edgeId, index, values) => index === 0 || edgeId !== values[index - 1],
    );
    return {
      coordinates,
      distanceMeters,
      estimatedGameDurationSeconds: routeDurationSeconds(distanceMeters),
      edgeIds,
    };
  }

  getDiagnostics(): RoutingDiagnostics {
    return {
      calculations: this.calculations,
      cacheHits: this.cacheHits,
      averageDurationMilliseconds:
        this.calculations === 0
          ? 0
          : this.totalDurationMilliseconds / this.calculations,
      lastExpandedNodeCount: this.lastExpandedNodeCount,
    };
  }
}

export class LocalRoutingService implements RoutingService {
  private routerPromise: Promise<AStarRouter> | null = null;

  constructor(
    private readonly networkLoader: () => Promise<LoadedRoadNetwork> = loadRoadNetwork,
  ) {}

  async getRoute(request: RouteRequest): Promise<RouteResult | null> {
    this.routerPromise ??= this.networkLoader().then(
      ({ network, index }) => new AStarRouter(network, index),
    );
    return (await this.routerPromise).getRoute(request);
  }
}

export const localRoutingService = new LocalRoutingService();

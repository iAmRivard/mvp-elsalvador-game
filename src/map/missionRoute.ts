import type { FeatureCollection, LineString, Point } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { routingConfig } from '../config/routing.config';
import { travelConfig } from '../config/travel.config';
import { missionById } from '../data/missions';
import { distanceBetweenMeters } from '../game/discovery';
import {
  nearestPendingObjective,
  objectiveIsAvailable,
  objectiveCoordinates,
} from '../game/missions';
import { localRoutingService } from '../roads/routingService';
import { useGameStore } from '../store/gameStore';
import type { RoadCoordinates } from '../types/roads';

const ROUTE_SOURCE_ID = 'active-mission-route';
const ROAD_CASING_LAYER_ID = 'active-mission-route-casing';
const ROAD_LAYER_ID = 'active-mission-route-road';
const FALLBACK_LAYER_ID = 'active-mission-route-fallback';
const TARGETS_SOURCE_ID = 'active-mission-targets';
const TARGETS_LAYER_ID = 'active-mission-targets-circles';

const emptyRoute: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: [],
};

const emptyTargets: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [],
};

function currentMissionTarget() {
  const state = useGameStore.getState();
  const mission = state.activeMissionId
    ? missionById.get(state.activeMissionId)
    : null;
  if (!mission) return null;
  const playerCoordinates: RoadCoordinates = [
    state.telemetry.longitude,
    state.telemetry.latitude,
  ];
  const next = nearestPendingObjective(
    mission,
    state.activeMissionCompletedObjectiveIds,
    playerCoordinates,
  );
  return next ? { state, mission, next, playerCoordinates } : null;
}

function updateTargets(map: MapLibreMap): void {
  const source = map.getSource<GeoJSONSource>(TARGETS_SOURCE_ID);
  if (!source) return;
  const target = currentMissionTarget();
  if (!target) {
    source.setData(emptyTargets);
    return;
  }
  const completed = new Set(target.state.activeMissionCompletedObjectiveIds);
  source.setData({
    type: 'FeatureCollection',
    features: target.mission.objectives.flatMap((objective) => {
      if (
        completed.has(objective.id) ||
        !objectiveIsAvailable(objective, completed)
      ) {
        return [];
      }
      const coordinates = objectiveCoordinates(objective);
      return coordinates
        ? [
            {
              type: 'Feature' as const,
              properties: {
                objectiveId: objective.id,
                isNext: objective.id === target.next.objective.id,
              },
              geometry: { type: 'Point' as const, coordinates },
            },
          ]
        : [];
    }),
  });
}

function targetKey(): string | null {
  const target = currentMissionTarget();
  return target ? `${target.mission.id}:${target.next.objective.id}` : null;
}

function pointSegmentDistanceMeters(
  point: RoadCoordinates,
  start: RoadCoordinates,
  end: RoadCoordinates,
): number {
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
  return Math.hypot(startX + deltaX * progress, startY + deltaY * progress);
}

export function distanceToRouteMeters(
  point: RoadCoordinates,
  route: readonly RoadCoordinates[],
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.length; index += 1) {
    nearest = Math.min(
      nearest,
      pointSegmentDistanceMeters(point, route[index - 1], route[index]),
    );
  }
  return nearest;
}

function fallbackDurationSeconds(distanceMeters: number): number {
  return (
    distanceMeters /
    (travelConfig.geographicTravelScale *
      travelConfig.normalMaximumSpeedMetersPerSecond *
      routingConfig.averageCruisingSpeedRatio)
  );
}

export function addMissionRoute(
  map: MapLibreMap,
  minimumUpdateIntervalMilliseconds = 100,
): () => void {
  map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: emptyRoute });
  map.addLayer({
    id: ROAD_CASING_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'mode'], 'road'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#17312c',
      'line-width': 8,
      'line-opacity': 0.78,
    },
  });
  map.addLayer({
    id: ROAD_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'mode'], 'road'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#e6b75f',
      'line-width': 4,
      'line-opacity': 0.92,
    },
  });
  map.addLayer({
    id: FALLBACK_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'mode'], 'fallback'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#d9aa56',
      'line-width': 3,
      'line-opacity': 0.66,
      'line-dasharray': [1.2, 1.8],
    },
  });

  map.addSource(TARGETS_SOURCE_ID, { type: 'geojson', data: emptyTargets });
  map.addLayer({
    id: TARGETS_LAYER_ID,
    type: 'circle',
    source: TARGETS_SOURCE_ID,
    paint: {
      'circle-radius': ['case', ['get', 'isNext'], 10, 7],
      'circle-color': '#e6b75f',
      'circle-opacity': 0.78,
      'circle-stroke-width': 3,
      'circle-stroke-color': '#fff1c9',
      'circle-stroke-opacity': 0.9,
    },
  });

  let disposed = false;
  let calculationToken = 0;
  let activeTargetKey = targetKey();
  let routeCoordinates: RoadCoordinates[] = [];
  let routeMode: 'road' | 'fallback' | null = null;
  let lastDeviationCheck = 0;
  let lastCalculationAt = 0;
  const routeSource = () => map.getSource<GeoJSONSource>(ROUTE_SOURCE_ID);
  const exposeRoute = (
    mode: 'road' | 'fallback' | null,
    coordinateCount: number,
  ) => {
    const container = map.getContainer();
    container.dataset.missionRouteMode = mode ?? 'idle';
    container.dataset.missionRouteCoordinateCount = String(coordinateCount);
  };
  const clearRoute = () => {
    routeCoordinates = [];
    routeMode = null;
    routeSource()?.setData(emptyRoute);
    exposeRoute(null, 0);
    useGameStore.getState().setMissionRoute({
      status: 'idle',
      distanceMeters: null,
      estimatedGameDurationSeconds: null,
      coordinateCount: 0,
      activeEdgeIds: [],
    });
  };

  const calculateRoute = async (): Promise<void> => {
    const target = currentMissionTarget();
    if (!target) {
      clearRoute();
      return;
    }
    const token = ++calculationToken;
    const calculationStartedAt = performance.now();
    lastCalculationAt = calculationStartedAt;
    useGameStore.getState().setMissionRoute({
      status: 'calculating',
      distanceMeters: null,
      estimatedGameDurationSeconds: null,
      coordinateCount: 0,
      activeEdgeIds: [],
    });
    exposeRoute(null, 0);

    const route = await localRoutingService
      .getRoute({
        origin: target.playerCoordinates,
        destination: target.next.coordinates,
        temporarilyClosedEdgeIds:
          useGameStore.getState().temporarilyClosedRoadEdgeIds,
      })
      .catch(() => null);
    map.getContainer().dataset.routeCalculationMs = (
      performance.now() - calculationStartedAt
    ).toFixed(2);
    if (disposed || token !== calculationToken) return;
    if (targetKey() !== `${target.mission.id}:${target.next.objective.id}`) {
      void calculateRoute();
      return;
    }

    if (route) {
      routeCoordinates = route.coordinates;
      routeMode = 'road';
      routeSource()?.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              missionId: target.mission.id,
              objectiveId: target.next.objective.id,
              mode: 'road',
            },
            geometry: { type: 'LineString', coordinates: route.coordinates },
          },
        ],
      });
      useGameStore.getState().setMissionRoute({
        status: 'road',
        distanceMeters: route.distanceMeters,
        estimatedGameDurationSeconds: route.estimatedGameDurationSeconds,
        coordinateCount: route.coordinates.length,
        activeEdgeIds: route.edgeIds,
      });
      exposeRoute('road', route.coordinates.length);
      return;
    }

    const coordinates = [
      target.playerCoordinates,
      target.next.coordinates,
    ] as RoadCoordinates[];
    const distanceMeters = distanceBetweenMeters(
      target.playerCoordinates,
      target.next.coordinates,
    );
    routeCoordinates = coordinates;
    routeMode = 'fallback';
    routeSource()?.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            missionId: target.mission.id,
            objectiveId: target.next.objective.id,
            mode: 'fallback',
          },
          geometry: { type: 'LineString', coordinates },
        },
      ],
    });
    useGameStore.getState().setMissionRoute({
      status: 'fallback',
      distanceMeters,
      estimatedGameDurationSeconds: fallbackDurationSeconds(distanceMeters),
      coordinateCount: coordinates.length,
      activeEdgeIds: [],
    });
    exposeRoute('fallback', coordinates.length);
  };

  updateTargets(map);
  void calculateRoute();
  let previousRecalculationRevision =
    useGameStore.getState().missionRoute.recalculationRevision;
  let previousClosedEdges =
    useGameStore.getState().temporarilyClosedRoadEdgeIds;
  const unsubscribe = useGameStore.subscribe((state, previousState) => {
    const nextTargetKey = targetKey();
    if (nextTargetKey !== activeTargetKey) {
      activeTargetKey = nextTargetKey;
      updateTargets(map);
      void calculateRoute();
      return;
    }
    if (
      state.missionRoute.recalculationRevision !==
        previousRecalculationRevision ||
      state.temporarilyClosedRoadEdgeIds !== previousClosedEdges
    ) {
      previousRecalculationRevision = state.missionRoute.recalculationRevision;
      previousClosedEdges = state.temporarilyClosedRoadEdgeIds;
      void calculateRoute();
      return;
    }
    if (state.telemetry === previousState.telemetry || routeMode !== 'road')
      return;

    const now = performance.now();
    const deviationInterval = Math.max(
      routingConfig.deviationCheckIntervalMilliseconds,
      minimumUpdateIntervalMilliseconds * 4,
    );
    if (now - lastDeviationCheck < deviationInterval) return;
    lastDeviationCheck = now;
    if (
      now - lastCalculationAt >=
        routingConfig.automaticRecalculationCooldownMilliseconds &&
      distanceToRouteMeters(
        [state.telemetry.longitude, state.telemetry.latitude],
        routeCoordinates,
      ) > routingConfig.routeDeviationDistanceMeters
    ) {
      void calculateRoute();
    }
  });

  return () => {
    disposed = true;
    calculationToken += 1;
    unsubscribe();
    if (map.getLayer(TARGETS_LAYER_ID)) map.removeLayer(TARGETS_LAYER_ID);
    if (map.getSource(TARGETS_SOURCE_ID)) map.removeSource(TARGETS_SOURCE_ID);
    if (map.getLayer(FALLBACK_LAYER_ID)) map.removeLayer(FALLBACK_LAYER_ID);
    if (map.getLayer(ROAD_LAYER_ID)) map.removeLayer(ROAD_LAYER_ID);
    if (map.getLayer(ROAD_CASING_LAYER_ID))
      map.removeLayer(ROAD_CASING_LAYER_ID);
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
  };
}

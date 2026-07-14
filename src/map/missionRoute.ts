import type { FeatureCollection, LineString, Point } from 'geojson';
import {
  Marker,
  type GeoJSONSource,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import { routingConfig } from '../config/routing.config';
import { travelConfig } from '../config/travel.config';
import { missionById } from '../data/missions';
import { distanceBetweenMeters } from '../game/discovery';
import {
  generateNavigationInstructions,
  navigationProgress,
  projectPositionOntoRoute,
} from './navigationInstructions';
import {
  nearestPendingObjective,
  objectiveIsAvailable,
  objectiveCoordinates,
} from '../game/missions';
import { localRoutingService } from '../roads/routingService';
import { getRoadWorkerClient } from '../roads/roadWorkerClient';
import { useGameStore } from '../store/gameStore';
import type { RoadCoordinates } from '../types/roads';
import type { RouteNavigationInstruction } from '../types/navigation';

const ROUTE_SOURCE_ID = 'active-mission-route';
const ROAD_CASING_LAYER_ID = 'active-mission-route-casing';
const ROAD_LAYER_ID = 'active-mission-route-road';
const FALLBACK_LAYER_ID = 'active-mission-route-fallback';
const IMMEDIATE_SOURCE_ID = 'active-mission-route-immediate';
const IMMEDIATE_LAYER_ID = 'active-mission-route-immediate-line';
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

export function distanceToRouteMeters(
  point: RoadCoordinates,
  route: readonly RoadCoordinates[],
): number {
  return (
    projectPositionOntoRoute(point, route)?.distanceMeters ??
    Number.POSITIVE_INFINITY
  );
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

  map.addSource(IMMEDIATE_SOURCE_ID, { type: 'geojson', data: emptyRoute });
  map.addLayer({
    id: IMMEDIATE_LAYER_ID,
    type: 'line',
    source: IMMEDIATE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#fff0bd',
      'line-width': 6,
      'line-opacity': 0.96,
    },
  });

  const maneuverMarkerElement = document.createElement('div');
  maneuverMarkerElement.className = 'mission-route-arrow';
  maneuverMarkerElement.textContent = '➤';
  maneuverMarkerElement.hidden = true;
  const maneuverMarker = new Marker({
    element: maneuverMarkerElement,
    anchor: 'center',
    rotationAlignment: 'map',
    pitchAlignment: 'map',
  })
    .setLngLat(map.getCenter())
    .addTo(map);

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
  let routeInstructions: RouteNavigationInstruction[] = [];
  let routeMode: 'road' | 'fallback' | null = null;
  let lastNavigationUpdate = 0;
  let lastDeviationCheck = 0;
  let lastCalculationAt = 0;
  const routeSource = () => map.getSource<GeoJSONSource>(ROUTE_SOURCE_ID);
  const immediateSource = () =>
    map.getSource<GeoJSONSource>(IMMEDIATE_SOURCE_ID);
  const exposeRoute = (
    mode: 'road' | 'fallback' | null,
    coordinateCount: number,
  ) => {
    const container = map.getContainer();
    container.dataset.missionRouteMode = mode ?? 'idle';
    container.dataset.missionRouteCoordinateCount = String(coordinateCount);
  };
  const updateNavigation = (position: RoadCoordinates) => {
    if (routeCoordinates.length < 2 || routeInstructions.length === 0) return;
    const progress = navigationProgress(
      position,
      routeCoordinates,
      routeInstructions,
    );
    immediateSource()?.setData({
      type: 'FeatureCollection',
      features:
        progress.immediateCoordinates.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: progress.immediateCoordinates,
                },
              },
            ]
          : [],
    });
    useGameStore.getState().setMissionNavigation({
      nextInstruction: progress.nextInstruction,
      distanceToNextInstructionMeters: progress.distanceToNextInstructionMeters,
      offRoute: progress.offRoute,
    });
    const markerInstruction =
      progress.nextInstruction?.type === 'continue'
        ? routeInstructions.find(
            (instruction) =>
              instruction.type !== 'continue' &&
              instruction.distanceFromRouteStartMeters >
                progress.distanceFromRouteStartMeters,
          )
        : progress.nextInstruction;
    if (!markerInstruction) {
      maneuverMarkerElement.hidden = true;
      return;
    }
    const nextCoordinate =
      routeCoordinates[
        Math.min(
          routeCoordinates.length - 1,
          markerInstruction.routeCoordinateIndex + 1,
        )
      ] ?? markerInstruction.coordinates;
    const latitude =
      ((markerInstruction.coordinates[1] + nextCoordinate[1]) / 2) *
      (Math.PI / 180);
    const heading =
      (Math.atan2(
        (nextCoordinate[0] - markerInstruction.coordinates[0]) *
          Math.cos(latitude),
        nextCoordinate[1] - markerInstruction.coordinates[1],
      ) *
        180) /
      Math.PI;
    maneuverMarker
      .setLngLat(markerInstruction.coordinates)
      .setRotation(heading);
    maneuverMarkerElement.hidden = false;
    const container = map.getContainer();
    container.dataset.navigationOffRoute = String(progress.offRoute);
    container.dataset.navigationNextType = progress.nextInstruction?.type ?? '';
    container.dataset.navigationNextDistance = String(
      Math.round(progress.distanceToNextInstructionMeters ?? 0),
    );
  };
  const clearRoute = () => {
    routeCoordinates = [];
    routeInstructions = [];
    routeMode = null;
    routeSource()?.setData(emptyRoute);
    immediateSource()?.setData(emptyRoute);
    maneuverMarkerElement.hidden = true;
    exposeRoute(null, 0);
    useGameStore.getState().setMissionRoute({
      status: 'idle',
      distanceMeters: null,
      estimatedGameDurationSeconds: null,
      coordinateCount: 0,
      activeEdgeIds: [],
      instructions: [],
      nextInstruction: null,
      distanceToNextInstructionMeters: null,
      offRoute: false,
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
    const wasOffRoute = useGameStore.getState().missionRoute.offRoute;
    routeMode = null;
    routeInstructions = [];
    routeSource()?.setData(emptyRoute);
    immediateSource()?.setData(emptyRoute);
    maneuverMarkerElement.hidden = true;
    useGameStore.getState().setMissionRoute({
      status: 'calculating',
      distanceMeters: null,
      estimatedGameDurationSeconds: null,
      coordinateCount: 0,
      activeEdgeIds: [],
      instructions: [],
      nextInstruction: null,
      distanceToNextInstructionMeters: null,
      offRoute: wasOffRoute,
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
    const workerDiagnostics = getRoadWorkerClient()?.getDiagnostics();
    if (typeof workerDiagnostics?.lastRouteDurationMilliseconds === 'number') {
      map.getContainer().dataset.routeWorkerMs =
        workerDiagnostics.lastRouteDurationMilliseconds.toFixed(2);
    }
    if (workerDiagnostics?.lastRoutingDiagnostics) {
      map.getContainer().dataset.routeExpandedNodes = String(
        workerDiagnostics.lastRoutingDiagnostics.lastExpandedNodeCount,
      );
      map.getContainer().dataset.routeCacheHits = String(
        workerDiagnostics.lastRoutingDiagnostics.cacheHits,
      );
      map.getContainer().dataset.routeCacheEntries = String(
        workerDiagnostics.lastRoutingDiagnostics.cacheEntries,
      );
    }
    if (disposed || token !== calculationToken) return;
    if (targetKey() !== `${target.mission.id}:${target.next.objective.id}`) {
      void calculateRoute();
      return;
    }

    if (route) {
      routeCoordinates = route.coordinates;
      routeInstructions = generateNavigationInstructions(route.coordinates);
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
        instructions: routeInstructions,
        nextInstruction: null,
        distanceToNextInstructionMeters: null,
        offRoute: false,
      });
      exposeRoute('road', route.coordinates.length);
      updateNavigation(target.playerCoordinates);
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
    routeInstructions = generateNavigationInstructions(coordinates);
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
      instructions: routeInstructions,
      nextInstruction: null,
      distanceToNextInstructionMeters: null,
      offRoute: false,
    });
    exposeRoute('fallback', coordinates.length);
    updateNavigation(target.playerCoordinates);
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
      previousRecalculationRevision = state.missionRoute.recalculationRevision;
      previousClosedEdges = state.temporarilyClosedRoadEdgeIds;
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
    if (state.telemetry === previousState.telemetry || routeMode === null)
      return;

    const now = performance.now();
    const navigationInterval = Math.max(
      200,
      minimumUpdateIntervalMilliseconds * 2,
    );
    if (now - lastNavigationUpdate >= navigationInterval) {
      lastNavigationUpdate = now;
      updateNavigation([state.telemetry.longitude, state.telemetry.latitude]);
    }
    if (routeMode !== 'road') return;
    const deviationInterval = Math.max(
      routingConfig.deviationCheckIntervalMilliseconds,
      minimumUpdateIntervalMilliseconds * 4,
    );
    if (now - lastDeviationCheck < deviationInterval) return;
    lastDeviationCheck = now;
    if (
      now - lastCalculationAt >=
        routingConfig.automaticRecalculationCooldownMilliseconds &&
      (projectPositionOntoRoute(
        [state.telemetry.longitude, state.telemetry.latitude],
        routeCoordinates,
      )?.distanceMeters ?? Number.POSITIVE_INFINITY) >
        routingConfig.routeDeviationDistanceMeters
    ) {
      void calculateRoute();
    }
  });

  return () => {
    disposed = true;
    calculationToken += 1;
    unsubscribe();
    maneuverMarker.remove();
    if (map.getLayer(TARGETS_LAYER_ID)) map.removeLayer(TARGETS_LAYER_ID);
    if (map.getSource(TARGETS_SOURCE_ID)) map.removeSource(TARGETS_SOURCE_ID);
    if (map.getLayer(IMMEDIATE_LAYER_ID)) map.removeLayer(IMMEDIATE_LAYER_ID);
    if (map.getSource(IMMEDIATE_SOURCE_ID))
      map.removeSource(IMMEDIATE_SOURCE_ID);
    if (map.getLayer(FALLBACK_LAYER_ID)) map.removeLayer(FALLBACK_LAYER_ID);
    if (map.getLayer(ROAD_LAYER_ID)) map.removeLayer(ROAD_LAYER_ID);
    if (map.getLayer(ROAD_CASING_LAYER_ID))
      map.removeLayer(ROAD_CASING_LAYER_ID);
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
  };
}

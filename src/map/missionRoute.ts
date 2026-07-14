import type { FeatureCollection, LineString, Point } from 'geojson';
import {
  Marker,
  type GeoJSONSource,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import { routingConfig } from '../config/routing.config';
import { fuelStationConfig } from '../config/fuelStations.config';
import {
  missionRouteColors,
  missionRouteStyle,
} from '../config/missionRoute.config';
import { travelConfig } from '../config/travel.config';
import {
  missionById,
  type Mission,
  type MissionObjective,
} from '../data/missions';
import { distanceBetweenMeters } from '../game/discovery';
import { getRecommendedMission } from '../game/missionRecommendations';
import { locationById } from '../data/locations';
import {
  generateNavigationInstructions,
  navigationProgress,
  projectPositionOntoRoute,
} from './navigationInstructions';
import { vehicleOrientation } from './navigationGuidance';
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
const REJOIN_SOURCE_ID = 'active-mission-route-rejoin';
const REJOIN_LAYER_ID = 'active-mission-route-rejoin-line';
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

interface RouteTarget {
  state: ReturnType<typeof useGameStore.getState>;
  mission: Mission | null;
  objective: MissionObjective | null;
  coordinates: RoadCoordinates;
  targetId: string;
  kind: 'mission-objective' | 'mission-start' | 'fuel-station' | 'location';
  key: string;
  playerCoordinates: RoadCoordinates;
}

function currentMissionTarget(): RouteTarget | null {
  const state = useGameStore.getState();
  const playerCoordinates: RoadCoordinates = [
    state.telemetry.longitude,
    state.telemetry.latitude,
  ];
  if (state.navigationTarget) {
    return {
      state,
      mission: null,
      objective: null,
      coordinates: state.navigationTarget.coordinates,
      targetId: state.navigationTarget.id,
      kind: state.navigationTarget.kind,
      key: `temporary:${state.navigationTarget.kind}:${state.navigationTarget.id}`,
      playerCoordinates,
    };
  }
  const mission = state.activeMissionId
    ? missionById.get(state.activeMissionId)
    : null;
  if (mission) {
    const next = nearestPendingObjective(
      mission,
      state.activeMissionCompletedObjectiveIds,
      playerCoordinates,
    );
    return next
      ? {
          state,
          mission,
          objective: next.objective,
          coordinates: next.coordinates,
          targetId: next.objective.id,
          kind: 'mission-objective',
          key: `${mission.id}:${next.objective.id}`,
          playerCoordinates,
        }
      : null;
  }
  const recommendation = getRecommendedMission(
    state.completedMissionIds,
    null,
    playerCoordinates,
  );
  const recommendedMission = recommendation
    ? missionById.get(recommendation.missionId)
    : null;
  const start = recommendation
    ? locationById.get(recommendation.startLocationId)
    : null;
  return recommendedMission && start
    ? {
        state,
        mission: recommendedMission,
        objective: null,
        coordinates: start.coordinates,
        targetId: `start:${start.id}`,
        kind: 'mission-start',
        key: `${recommendedMission.id}:start:${start.id}`,
        playerCoordinates,
      }
    : null;
}

function updateTargets(map: MapLibreMap): void {
  const source = map.getSource<GeoJSONSource>(TARGETS_SOURCE_ID);
  if (!source) return;
  const target = currentMissionTarget();
  if (!target) {
    const container = map.getContainer();
    container.dataset.navigationTargetKind = '';
    container.dataset.navigationTargetId = '';
    source.setData(emptyTargets);
    return;
  }
  const container = map.getContainer();
  container.dataset.navigationTargetKind = target.kind;
  container.dataset.navigationTargetId = target.targetId;
  if (target.kind === 'fuel-station' || target.kind === 'location') {
    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            objectiveId: target.targetId,
            isNext: true,
            isFuelStation: target.kind === 'fuel-station',
          },
          geometry: { type: 'Point', coordinates: target.coordinates },
        },
      ],
    });
    return;
  }
  if (target.kind === 'mission-start') {
    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            objectiveId: target.targetId,
            isNext: true,
            isFuelStation: false,
          },
          geometry: { type: 'Point', coordinates: target.coordinates },
        },
      ],
    });
    return;
  }
  if (!target.mission) {
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
                isNext: objective.id === target.targetId,
                isFuelStation: false,
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
  return target?.key ?? null;
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
  const mapContainer = map.getContainer();
  mapContainer.dataset.missionRouteCasingColor = missionRouteColors.casing;
  mapContainer.dataset.missionRouteRoadColor = missionRouteColors.road;
  mapContainer.dataset.missionRouteImmediateColor =
    missionRouteColors.immediate;
  mapContainer.dataset.missionRouteFallbackColor = missionRouteColors.fallback;
  mapContainer.dataset.missionRouteTargetColor = missionRouteColors.target;
  mapContainer.dataset.missionRouteFuelColor = fuelStationConfig.markerColor;
  map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: emptyRoute });
  map.addLayer({
    id: ROAD_CASING_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'mode'], 'road'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': missionRouteColors.casing,
      'line-width': missionRouteStyle.casingWidth,
      'line-opacity': missionRouteStyle.casingOpacity,
    },
  });
  map.addLayer({
    id: ROAD_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'mode'], 'road'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': missionRouteColors.road,
      'line-width': missionRouteStyle.roadWidth,
      'line-opacity': missionRouteStyle.roadOpacity,
    },
  });
  map.addLayer({
    id: FALLBACK_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'mode'], 'fallback'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': missionRouteColors.fallback,
      'line-width': missionRouteStyle.fallbackWidth,
      'line-opacity': missionRouteStyle.fallbackOpacity,
      'line-dasharray': [1.4, 1.8],
    },
  });

  map.addSource(REJOIN_SOURCE_ID, { type: 'geojson', data: emptyRoute });
  map.addLayer({
    id: REJOIN_LAYER_ID,
    type: 'line',
    source: REJOIN_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': missionRouteColors.immediate,
      'line-width': 4.5,
      'line-opacity': 0.8,
      'line-dasharray': [1.3, 1.4],
    },
  });

  map.addSource(IMMEDIATE_SOURCE_ID, { type: 'geojson', data: emptyRoute });
  map.addLayer({
    id: IMMEDIATE_LAYER_ID,
    type: 'line',
    source: IMMEDIATE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': missionRouteColors.immediate,
      'line-width': missionRouteStyle.immediateWidth,
      'line-opacity': missionRouteStyle.immediateOpacity,
    },
  });

  const maneuverMarkerElement = document.createElement('div');
  maneuverMarkerElement.className =
    'mission-route-arrow navigation-guidance-arrow';
  maneuverMarkerElement.setAttribute('role', 'img');
  maneuverMarkerElement.setAttribute(
    'aria-label',
    'Dirección recomendada de la ruta',
  );
  maneuverMarkerElement.textContent = '↑';
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
      'circle-color': [
        'case',
        ['get', 'isFuelStation'],
        fuelStationConfig.markerColor,
        missionRouteColors.target,
      ],
      'circle-opacity': 0.92,
      'circle-stroke-width': 3,
      'circle-stroke-color': missionRouteColors.immediate,
      'circle-stroke-opacity': 0.96,
    },
  });

  let disposed = false;
  let calculationToken = 0;
  let activeTargetKey = targetKey();
  let routeCoordinates: RoadCoordinates[] = [];
  let routeInstructions: RouteNavigationInstruction[] = [];
  let routeMode: 'road' | 'fallback' | null = null;
  let lastKnownSegmentIndex: number | null = null;
  let lastNavigationUpdate = 0;
  let lastDeviationCheck = 0;
  let lastCalculationAt = 0;
  const routeSource = () => map.getSource<GeoJSONSource>(ROUTE_SOURCE_ID);
  const immediateSource = () =>
    map.getSource<GeoJSONSource>(IMMEDIATE_SOURCE_ID);
  const rejoinSource = () => map.getSource<GeoJSONSource>(REJOIN_SOURCE_ID);
  const exposeRoute = (
    mode: 'road' | 'fallback' | null,
    coordinateCount: number,
  ) => {
    const container = map.getContainer();
    container.dataset.missionRouteMode = mode ?? 'idle';
    container.dataset.missionRouteCoordinateCount = String(coordinateCount);
  };
  const updateNavigation = (
    position: RoadCoordinates,
    physicalHeading: number,
  ) => {
    if (
      routeMode !== 'road' ||
      routeCoordinates.length < 2 ||
      routeInstructions.length === 0
    ) {
      immediateSource()?.setData(emptyRoute);
      rejoinSource()?.setData(emptyRoute);
      maneuverMarkerElement.hidden = true;
      useGameStore.getState().setMissionNavigation({
        nextInstruction: null,
        distanceToNextInstructionMeters: null,
        offRoute: false,
        activeNavigation: null,
        orientation: vehicleOrientation(physicalHeading, null),
      });
      return;
    }
    const progress = navigationProgress(
      position,
      routeCoordinates,
      routeInstructions,
      physicalHeading,
      lastKnownSegmentIndex,
    );
    lastKnownSegmentIndex =
      progress.activeNavigation?.routeSegmentIndex ?? lastKnownSegmentIndex;
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
    rejoinSource()?.setData({
      type: 'FeatureCollection',
      features:
        progress.rejoinCoordinates.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: progress.rejoinCoordinates,
                },
              },
            ]
          : [],
    });
    const orientation = vehicleOrientation(
      physicalHeading,
      progress.activeNavigation?.recommendedHeading ?? null,
    );
    useGameStore.getState().setMissionNavigation({
      nextInstruction: progress.nextInstruction,
      distanceToNextInstructionMeters: progress.distanceToNextInstructionMeters,
      offRoute: progress.offRoute,
      activeNavigation: progress.activeNavigation,
      orientation,
    });
    if (
      !progress.activeNavigation ||
      orientation.headingDifference === null ||
      Math.abs(orientation.headingDifference) <=
        routingConfig.headingAlignmentThresholdDegrees
    ) {
      maneuverMarkerElement.hidden = true;
    } else {
      maneuverMarker
        .setLngLat(position)
        .setRotation(progress.activeNavigation.recommendedHeading);
      maneuverMarkerElement.hidden = false;
    }
    const container = map.getContainer();
    container.dataset.navigationOffRoute = String(progress.offRoute);
    container.dataset.navigationRequiresRejoin = String(
      progress.activeNavigation?.requiresRejoin ?? false,
    );
    container.dataset.navigationRouteSegment = String(
      progress.activeNavigation?.routeSegmentIndex ?? '',
    );
    container.dataset.navigationRecommendedHeading =
      progress.activeNavigation?.recommendedHeading.toFixed(1) ?? '';
    container.dataset.navigationPhysicalHeading = physicalHeading.toFixed(1);
    container.dataset.navigationNextType = progress.nextInstruction?.type ?? '';
    container.dataset.navigationNextDistance = String(
      Math.round(progress.distanceToNextInstructionMeters ?? 0),
    );
  };
  const clearRoute = () => {
    routeCoordinates = [];
    routeInstructions = [];
    routeMode = null;
    lastKnownSegmentIndex = null;
    routeSource()?.setData(emptyRoute);
    immediateSource()?.setData(emptyRoute);
    rejoinSource()?.setData(emptyRoute);
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
      activeNavigation: null,
      orientation: vehicleOrientation(
        useGameStore.getState().telemetry.heading,
        null,
      ),
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
    lastKnownSegmentIndex = null;
    routeSource()?.setData(emptyRoute);
    immediateSource()?.setData(emptyRoute);
    rejoinSource()?.setData(emptyRoute);
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
      activeNavigation: null,
      orientation: vehicleOrientation(target.state.telemetry.heading, null),
    });
    exposeRoute(null, 0);

    const route = await localRoutingService
      .getRoute({
        origin: target.playerCoordinates,
        destination: target.coordinates,
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
    if (targetKey() !== target.key) {
      void calculateRoute();
      return;
    }

    if (route) {
      routeCoordinates = route.coordinates;
      routeInstructions = generateNavigationInstructions(route.coordinates);
      routeMode = 'road';
      lastKnownSegmentIndex = null;
      routeSource()?.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              missionId: target.mission?.id ?? null,
              navigationTargetKind: target.kind,
              objectiveId: target.targetId,
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
        activeNavigation: null,
        orientation: vehicleOrientation(target.state.telemetry.heading, null),
      });
      exposeRoute('road', route.coordinates.length);
      updateNavigation(
        target.playerCoordinates,
        target.state.telemetry.heading,
      );
      return;
    }

    const coordinates = [
      target.playerCoordinates,
      target.coordinates,
    ] as RoadCoordinates[];
    const distanceMeters = distanceBetweenMeters(
      target.playerCoordinates,
      target.coordinates,
    );
    routeCoordinates = coordinates;
    routeInstructions = generateNavigationInstructions(coordinates);
    routeMode = 'fallback';
    lastKnownSegmentIndex = null;
    routeSource()?.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            missionId: target.mission?.id ?? null,
            navigationTargetKind: target.kind,
            objectiveId: target.targetId,
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
      activeNavigation: null,
      orientation: vehicleOrientation(target.state.telemetry.heading, null),
    });
    exposeRoute('fallback', coordinates.length);
    updateNavigation(target.playerCoordinates, target.state.telemetry.heading);
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
      updateNavigation(
        [state.telemetry.longitude, state.telemetry.latitude],
        state.telemetry.heading,
      );
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
    if (map.getLayer(REJOIN_LAYER_ID)) map.removeLayer(REJOIN_LAYER_ID);
    if (map.getSource(REJOIN_SOURCE_ID)) map.removeSource(REJOIN_SOURCE_ID);
    if (map.getLayer(FALLBACK_LAYER_ID)) map.removeLayer(FALLBACK_LAYER_ID);
    if (map.getLayer(ROAD_LAYER_ID)) map.removeLayer(ROAD_LAYER_ID);
    if (map.getLayer(ROAD_CASING_LAYER_ID))
      map.removeLayer(ROAD_CASING_LAYER_ID);
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    delete mapContainer.dataset.missionRouteCasingColor;
    delete mapContainer.dataset.missionRouteRoadColor;
    delete mapContainer.dataset.missionRouteImmediateColor;
    delete mapContainer.dataset.missionRouteFallbackColor;
    delete mapContainer.dataset.missionRouteTargetColor;
    delete mapContainer.dataset.missionRouteFuelColor;
    delete mapContainer.dataset.navigationTargetKind;
    delete mapContainer.dataset.navigationTargetId;
  };
}

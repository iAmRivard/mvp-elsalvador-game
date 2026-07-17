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
import { vehicleIsReversing, vehicleOrientation } from './navigationGuidance';
import {
  nearestPendingObjective,
  objectiveIsAvailable,
  objectiveNarrativeCoordinates,
} from '../game/missions';
import { localRoutingService } from '../roads/routingService';
import { getRoadWorkerClient } from '../roads/roadWorkerClient';
import { useGameStore } from '../store/gameStore';
import type { RoadCoordinates } from '../types/roads';
import type { RouteNavigationInstruction } from '../types/navigation';
import { createTrailingUpdateScheduler } from './trailingUpdateScheduler';
import { createNavigationGuidanceElement } from './navigationGuidanceMarker';

const ROUTE_SOURCE_ID = 'active-mission-route';
const ROAD_CASING_LAYER_ID = 'active-mission-route-casing';
const ROAD_LAYER_ID = 'active-mission-route-road';
const ROAD_CHEVRON_LAYER_ID = 'active-mission-route-chevrons';
const FALLBACK_LAYER_ID = 'active-mission-route-fallback';
const REJOIN_SOURCE_ID = 'active-mission-route-rejoin';
const REJOIN_LAYER_ID = 'active-mission-route-rejoin-line';
const IMMEDIATE_SOURCE_ID = 'active-mission-route-immediate';
const IMMEDIATE_LAYER_ID = 'active-mission-route-immediate-line';
const IMMEDIATE_CHEVRON_LAYER_ID = 'active-mission-route-immediate-chevrons';
const NAVIGATION_ARROW_LOOKAHEAD_METERS = 90;
const TARGETS_SOURCE_ID = 'active-mission-targets';
const TARGETS_LAYER_ID = 'active-mission-targets-circles';

export function routeOriginMovedBeyondTolerance(
  origin: RoadCoordinates,
  currentPosition: RoadCoordinates,
  toleranceMeters = routingConfig.routeRejoinDistanceMeters,
): boolean {
  return distanceBetweenMeters(origin, currentPosition) > toleranceMeters;
}

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
      // Navigation ends at the playable interaction point, while the target
      // marker remains at the authored narrative location.
      const coordinates = objectiveNarrativeCoordinates(objective);
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

export function navigationArrowPosition(
  routeCoordinates: readonly RoadCoordinates[],
  activeSegmentIndex: number,
  lookAheadMeters: number,
): RoadCoordinates | null {
  if (
    routeCoordinates.length < 2 ||
    activeSegmentIndex < 0 ||
    activeSegmentIndex >= routeCoordinates.length - 1 ||
    !Number.isFinite(lookAheadMeters) ||
    lookAheadMeters <= 0
  ) {
    return null;
  }
  let remainingMeters = lookAheadMeters;
  for (
    let index = activeSegmentIndex;
    index < routeCoordinates.length - 1;
    index += 1
  ) {
    const start = routeCoordinates[index];
    const end = routeCoordinates[index + 1];
    const segmentMeters = distanceBetweenMeters(start, end);
    if (segmentMeters <= 0.01) continue;
    if (remainingMeters <= segmentMeters) {
      const progress = remainingMeters / segmentMeters;
      return [
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress,
      ];
    }
    remainingMeters -= segmentMeters;
  }
  return null;
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
  reducedMotion = false,
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
    id: ROAD_CHEVRON_LAYER_ID,
    type: 'symbol',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'mode'], 'road'],
    layout: {
      visibility: reducedMotion ? 'none' : 'visible',
      'symbol-placement': 'line',
      'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 12, 100, 16, 58],
      'text-field': '›',
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 13, 16, 18],
      'text-rotation-alignment': 'map',
      'text-keep-upright': false,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': missionRouteColors.immediate,
      'text-opacity': 0.38,
      'text-halo-color': missionRouteColors.casing,
      'text-halo-width': 1,
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
  map.addLayer({
    id: IMMEDIATE_CHEVRON_LAYER_ID,
    type: 'symbol',
    source: IMMEDIATE_SOURCE_ID,
    layout: {
      visibility: reducedMotion ? 'none' : 'visible',
      'symbol-placement': 'line',
      'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 12, 78, 16, 44],
      'text-field': '›',
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 15, 16, 21],
      'text-rotation-alignment': 'map',
      'text-keep-upright': false,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#fff4cd',
      'text-opacity': 0.9,
      'text-halo-color': missionRouteColors.casing,
      'text-halo-width': 1.5,
    },
  });

  const maneuverMarkerElement = createNavigationGuidanceElement();
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
  let routeTargetKey: string | null = null;
  let lastKnownSegmentIndex: number | null = null;
  let lastDeviationCheck = 0;
  let lastCalculationAt = 0;
  const routeSource = () => map.getSource<GeoJSONSource>(ROUTE_SOURCE_ID);
  const immediateSource = () =>
    map.getSource<GeoJSONSource>(IMMEDIATE_SOURCE_ID);
  const rejoinSource = () => map.getSource<GeoJSONSource>(REJOIN_SOURCE_ID);
  interface LineSourceSnapshot {
    key: string;
    coordinates: RoadCoordinates[];
  }
  const routeSourceSnapshot: LineSourceSnapshot = {
    key: 'empty',
    coordinates: [],
  };
  const immediateSourceSnapshot: LineSourceSnapshot = {
    key: 'empty',
    coordinates: [],
  };
  const rejoinSourceSnapshot: LineSourceSnapshot = {
    key: 'empty',
    coordinates: [],
  };
  const sameCoordinates = (
    previous: readonly RoadCoordinates[],
    next: readonly RoadCoordinates[],
  ) =>
    previous.length === next.length &&
    previous.every(
      (coordinate, index) =>
        coordinate[0] === next[index]?.[0] &&
        coordinate[1] === next[index]?.[1],
    );
  const setLineSourceData = (
    source: () => GeoJSONSource | undefined,
    snapshot: LineSourceSnapshot,
    key: string,
    coordinates: readonly RoadCoordinates[],
    properties: Record<string, string | null> = {},
  ) => {
    if (
      snapshot.key === key &&
      sameCoordinates(snapshot.coordinates, coordinates)
    ) {
      return;
    }
    const currentSource = source();
    if (!currentSource) return;
    const data: FeatureCollection<LineString> =
      coordinates.length >= 2
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties,
                geometry: { type: 'LineString', coordinates: [...coordinates] },
              },
            ],
          }
        : emptyRoute;
    currentSource.setData(data);
    snapshot.key = key;
    snapshot.coordinates = coordinates.map(([longitude, latitude]) => [
      longitude,
      latitude,
    ]);
    const container = map.getContainer();
    container.dataset.geoJsonSourceUpdates = String(
      Number(container.dataset.geoJsonSourceUpdates ?? 0) + 1,
    );
  };
  const exposeRoute = (
    mode: 'road' | 'fallback' | null,
    coordinateCount: number,
  ) => {
    const container = map.getContainer();
    container.dataset.missionRouteMode = mode ?? 'idle';
    container.dataset.missionRouteCoordinateCount = String(coordinateCount);
    useGameStore
      .getState()
      .setMissionRouteVisualReady(mode !== null && coordinateCount >= 2);
  };
  const updateNavigation = (
    position: RoadCoordinates,
    physicalHeading: number,
  ) => {
    mapContainer.dataset.navigationLastPositionLongitude = String(position[0]);
    mapContainer.dataset.navigationLastPositionLatitude = String(position[1]);
    if (
      routeMode !== 'road' ||
      routeCoordinates.length < 2 ||
      routeInstructions.length === 0
    ) {
      setLineSourceData(immediateSource, immediateSourceSnapshot, 'empty', []);
      setLineSourceData(rejoinSource, rejoinSourceSnapshot, 'empty', []);
      mapContainer.dataset.navigationRejoinStartLongitude = '';
      mapContainer.dataset.navigationRejoinStartLatitude = '';
      maneuverMarkerElement.hidden = true;
      mapContainer.dataset.navigationReversing = String(
        vehicleIsReversing(
          useGameStore.getState().telemetry.speedMetersPerSecond,
        ),
      );
      mapContainer.dataset.navigationOffRoute = 'false';
      mapContainer.dataset.navigationRequiresRejoin = 'false';
      mapContainer.dataset.navigationRouteSegment = '';
      mapContainer.dataset.navigationRecommendedHeading = '';
      mapContainer.dataset.navigationPhysicalHeading =
        physicalHeading.toFixed(1);
      mapContainer.dataset.navigationNextType = '';
      mapContainer.dataset.navigationNextDistance = '0';
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
    const gameState = useGameStore.getState();
    const reversing = vehicleIsReversing(
      gameState.telemetry.speedMetersPerSecond,
    );
    lastKnownSegmentIndex =
      progress.activeNavigation?.routeSegmentIndex ?? lastKnownSegmentIndex;
    setLineSourceData(
      immediateSource,
      immediateSourceSnapshot,
      'immediate',
      reversing ? [] : progress.immediateCoordinates,
    );
    setLineSourceData(
      rejoinSource,
      rejoinSourceSnapshot,
      'rejoin',
      reversing ? [] : progress.rejoinCoordinates,
    );
    const rejoinStart = reversing ? undefined : progress.rejoinCoordinates[0];
    mapContainer.dataset.navigationRejoinStartLongitude = String(
      rejoinStart?.[0] ?? '',
    );
    mapContainer.dataset.navigationRejoinStartLatitude = String(
      rejoinStart?.[1] ?? '',
    );
    const orientation = vehicleOrientation(
      physicalHeading,
      progress.activeNavigation?.recommendedHeading ?? null,
    );
    gameState.setMissionNavigation({
      nextInstruction: progress.nextInstruction,
      distanceToNextInstructionMeters: progress.distanceToNextInstructionMeters,
      offRoute: progress.offRoute,
      activeNavigation: progress.activeNavigation,
      orientation,
    });
    const arrowPosition = navigationArrowPosition(
      progress.immediateCoordinates,
      0,
      NAVIGATION_ARROW_LOOKAHEAD_METERS,
    );
    if (
      reversing ||
      !progress.activeNavigation ||
      orientation.headingDifference === null ||
      !arrowPosition
    ) {
      maneuverMarkerElement.hidden = true;
      const container = map.getContainer();
      container.dataset.navigationArrowLongitude = '';
      container.dataset.navigationArrowLatitude = '';
      container.dataset.navigationArrowFallback = '';
    } else {
      maneuverMarker
        .setLngLat(arrowPosition)
        .setOffset([0, 0])
        .setRotation(progress.activeNavigation.recommendedHeading);
      maneuverMarkerElement.hidden = false;
      const container = map.getContainer();
      container.dataset.navigationArrowLongitude = String(
        arrowPosition[0],
      );
      container.dataset.navigationArrowLatitude = String(
        arrowPosition[1],
      );
      container.dataset.navigationArrowFallback = 'false';
    }
    const container = map.getContainer();
    container.dataset.navigationReversing = String(reversing);
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
  const navigationUpdates = createTrailingUpdateScheduler(
    Math.max(200, minimumUpdateIntervalMilliseconds * 2),
    (sample: { position: RoadCoordinates; heading: number }) => {
      updateNavigation(sample.position, sample.heading);
    },
  );
  const clearRoute = () => {
    navigationUpdates.cancel();
    routeCoordinates = [];
    routeInstructions = [];
    routeMode = null;
    routeTargetKey = null;
    lastKnownSegmentIndex = null;
    setLineSourceData(routeSource, routeSourceSnapshot, 'empty', []);
    setLineSourceData(immediateSource, immediateSourceSnapshot, 'empty', []);
    setLineSourceData(rejoinSource, rejoinSourceSnapshot, 'empty', []);
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
    const hasUsableRoute =
      routeTargetKey === target.key &&
      routeMode !== null &&
      routeCoordinates.length >= 2;
    if (!hasUsableRoute) {
      navigationUpdates.cancel();
    }
    const token = ++calculationToken;
    const calculationStartedAt = performance.now();
    lastCalculationAt = calculationStartedAt;
    mapContainer.dataset.routeRequestedOriginLongitude = String(
      target.playerCoordinates[0],
    );
    mapContainer.dataset.routeRequestedOriginLatitude = String(
      target.playerCoordinates[1],
    );
    mapContainer.dataset.routeRecalculating = 'true';
    if (!hasUsableRoute) {
      const wasOffRoute = useGameStore.getState().missionRoute.offRoute;
      routeMode = null;
      routeTargetKey = null;
      routeInstructions = [];
      lastKnownSegmentIndex = null;
      setLineSourceData(routeSource, routeSourceSnapshot, 'empty', []);
      setLineSourceData(immediateSource, immediateSourceSnapshot, 'empty', []);
      setLineSourceData(rejoinSource, rejoinSourceSnapshot, 'empty', []);
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
    }

    const route =
      useGameStore.getState().driving.roadNetworkStatus === 'unavailable'
        ? null
        : await localRoutingService
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
    const latestTarget = currentMissionTarget();
    if (!latestTarget || latestTarget.key !== target.key) {
      void calculateRoute();
      return;
    }
    const originMoved = routeOriginMovedBeyondTolerance(
      target.playerCoordinates,
      latestTarget.playerCoordinates,
    );
    if (originMoved) {
      mapContainer.dataset.routeDiscardedStaleOrigins = String(
        Number(mapContainer.dataset.routeDiscardedStaleOrigins ?? 0) + 1,
      );
    }

    if (route) {
      routeCoordinates = route.coordinates;
      routeInstructions = generateNavigationInstructions(route.coordinates);
      routeMode = 'road';
      routeTargetKey = target.key;
      lastKnownSegmentIndex = null;
      setLineSourceData(
        routeSource,
        routeSourceSnapshot,
        `road:${target.key}`,
        route.coordinates,
        {
          missionId: target.mission?.id ?? null,
          navigationTargetKind: target.kind,
          objectiveId: target.targetId,
          mode: 'road',
        },
      );
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
        orientation: vehicleOrientation(
          latestTarget.state.telemetry.heading,
          null,
        ),
      });
      exposeRoute('road', route.coordinates.length);
      updateNavigation(
        latestTarget.playerCoordinates,
        latestTarget.state.telemetry.heading,
      );
      mapContainer.dataset.routeRecalculating = String(originMoved);
      if (originMoved) void calculateRoute();
      return;
    }

    const coordinates = [
      latestTarget.playerCoordinates,
      target.coordinates,
    ] as RoadCoordinates[];
    const distanceMeters = distanceBetweenMeters(
      latestTarget.playerCoordinates,
      target.coordinates,
    );
    routeCoordinates = coordinates;
    routeInstructions = generateNavigationInstructions(coordinates);
    routeMode = 'fallback';
    routeTargetKey = target.key;
    lastKnownSegmentIndex = null;
    setLineSourceData(
      routeSource,
      routeSourceSnapshot,
      `fallback:${target.key}`,
      coordinates,
      {
        missionId: target.mission?.id ?? null,
        navigationTargetKind: target.kind,
        objectiveId: target.targetId,
        mode: 'fallback',
      },
    );
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
      orientation: vehicleOrientation(
        latestTarget.state.telemetry.heading,
        null,
      ),
    });
    exposeRoute('fallback', coordinates.length);
    updateNavigation(
      latestTarget.playerCoordinates,
      latestTarget.state.telemetry.heading,
    );
    mapContainer.dataset.routeRecalculating = String(originMoved);
    if (originMoved) void calculateRoute();
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
    navigationUpdates.schedule({
      position: [state.telemetry.longitude, state.telemetry.latitude],
      heading: state.telemetry.heading,
    });
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
    navigationUpdates.cancel();
    unsubscribe();
    maneuverMarker.remove();
    if (map.getLayer(TARGETS_LAYER_ID)) map.removeLayer(TARGETS_LAYER_ID);
    if (map.getSource(TARGETS_SOURCE_ID)) map.removeSource(TARGETS_SOURCE_ID);
    if (map.getLayer(IMMEDIATE_CHEVRON_LAYER_ID))
      map.removeLayer(IMMEDIATE_CHEVRON_LAYER_ID);
    if (map.getLayer(IMMEDIATE_LAYER_ID)) map.removeLayer(IMMEDIATE_LAYER_ID);
    if (map.getSource(IMMEDIATE_SOURCE_ID))
      map.removeSource(IMMEDIATE_SOURCE_ID);
    if (map.getLayer(REJOIN_LAYER_ID)) map.removeLayer(REJOIN_LAYER_ID);
    if (map.getSource(REJOIN_SOURCE_ID)) map.removeSource(REJOIN_SOURCE_ID);
    if (map.getLayer(FALLBACK_LAYER_ID)) map.removeLayer(FALLBACK_LAYER_ID);
    if (map.getLayer(ROAD_CHEVRON_LAYER_ID))
      map.removeLayer(ROAD_CHEVRON_LAYER_ID);
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

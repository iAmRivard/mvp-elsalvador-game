import type { FeatureCollection, LineString, Point } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { missionById } from '../data/missions';
import {
  nearestPendingObjective,
  objectiveCoordinates,
} from '../game/missions';
import { useGameStore } from '../store/gameStore';

const ROUTE_SOURCE_ID = 'active-mission-route';
const ROUTE_LAYER_ID = 'active-mission-route-line';
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

function updateMissionRoute(map: MapLibreMap): void {
  const routeSource = map.getSource<GeoJSONSource>(ROUTE_SOURCE_ID);
  const targetsSource = map.getSource<GeoJSONSource>(TARGETS_SOURCE_ID);
  if (!routeSource || !targetsSource) return;

  const state = useGameStore.getState();
  const mission = state.activeMissionId
    ? missionById.get(state.activeMissionId)
    : null;
  if (!mission) {
    routeSource.setData(emptyRoute);
    targetsSource.setData(emptyTargets);
    return;
  }

  const playerCoordinates: [number, number] = [
    state.telemetry.longitude,
    state.telemetry.latitude,
  ];
  const next = nearestPendingObjective(
    mission,
    state.activeMissionCompletedObjectiveIds,
    playerCoordinates,
  );
  const route: FeatureCollection<LineString> = next
    ? {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { missionId: mission.id },
            geometry: {
              type: 'LineString',
              coordinates: [playerCoordinates, next.coordinates],
            },
          },
        ],
      }
    : emptyRoute;
  const completed = new Set(state.activeMissionCompletedObjectiveIds);
  const targets: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: mission.objectives.flatMap((objective) => {
      if (completed.has(objective.id)) return [];
      const coordinates = objectiveCoordinates(objective);
      return coordinates
        ? [
            {
              type: 'Feature' as const,
              properties: {
                objectiveId: objective.id,
                isNext: objective.id === next?.objective.id,
              },
              geometry: { type: 'Point' as const, coordinates },
            },
          ]
        : [];
    }),
  };

  routeSource.setData(route);
  targetsSource.setData(targets);
}

export function addMissionRoute(
  map: MapLibreMap,
  minimumUpdateIntervalMilliseconds = 100,
): () => void {
  map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: emptyRoute });
  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#e6b75f',
      'line-width': 4,
      'line-opacity': 0.85,
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

  updateMissionRoute(map);
  let lastTelemetryUpdate = performance.now();
  const unsubscribe = useGameStore.subscribe((state, previousState) => {
    const missionChanged =
      state.activeMissionId !== previousState.activeMissionId ||
      state.activeMissionCompletedObjectiveIds !==
        previousState.activeMissionCompletedObjectiveIds;
    if (missionChanged) {
      updateMissionRoute(map);
      lastTelemetryUpdate = performance.now();
      return;
    }
    if (state.telemetry === previousState.telemetry) return;

    const now = performance.now();
    if (now - lastTelemetryUpdate < minimumUpdateIntervalMilliseconds) return;
    updateMissionRoute(map);
    lastTelemetryUpdate = now;
  });

  return () => {
    unsubscribe();
    if (map.getLayer(TARGETS_LAYER_ID)) map.removeLayer(TARGETS_LAYER_ID);
    if (map.getSource(TARGETS_SOURCE_ID)) map.removeSource(TARGETS_SOURCE_ID);
    if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
  };
}

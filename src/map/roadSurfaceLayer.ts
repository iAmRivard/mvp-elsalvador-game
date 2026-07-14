import type { FeatureCollection, LineString } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { RoadNetwork } from '../types/roads';

const SOURCE_ID = 'playable-road-surfaces';
const CASING_LAYER_ID = 'playable-dirt-road-casing';
const LAYER_ID = 'playable-dirt-roads';

function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  return map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
}

export function addPlayableRoadSurfaceLayer(
  map: MapLibreMap,
  network: RoadNetwork,
): () => void {
  const data: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: network.edges
      .filter((edge) => edge.surface === 'dirt-road')
      .map((edge) => ({
        type: 'Feature',
        properties: { edgeId: edge.id },
        geometry: { type: 'LineString', coordinates: edge.coordinates },
      })),
  };
  if (data.features.length === 0 || !map.getStyle()) return () => undefined;

  const beforeId = firstSymbolLayerId(map);
  map.addSource(SOURCE_ID, { type: 'geojson', data });
  map.addLayer(
    {
      id: CASING_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      minzoom: 9,
      paint: {
        'line-color': '#30291f',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.4, 15, 5.2],
        'line-opacity': 0.8,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      minzoom: 9,
      paint: {
        'line-color': '#b28a5b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 15, 3.2],
        'line-dasharray': [1.5, 1.25],
        'line-opacity': 0.92,
      },
    },
    beforeId,
  );

  return () => {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getLayer(CASING_LAYER_ID)) map.removeLayer(CASING_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  };
}

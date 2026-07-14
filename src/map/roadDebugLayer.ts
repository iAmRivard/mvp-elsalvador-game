import type { FeatureCollection, LineString } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { roadNetworkConfig } from '../config/roads.config';
import { loadRoadNetwork } from '../roads/roadNetwork';

const SOURCE_ID = 'road-network-debug';
const LAYER_ID = 'road-network-debug-lines';

export async function addRoadDebugLayer(map: MapLibreMap): Promise<() => void> {
  if (!roadNetworkConfig.debugVisible) return () => undefined;
  const { network } = await loadRoadNetwork();
  if (!map.getStyle()) return () => undefined;

  const data: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: network.edges.map((edge) => ({
      type: 'Feature',
      properties: { edgeId: edge.id, roadClass: edge.roadClass },
      geometry: { type: 'LineString', coordinates: edge.coordinates },
    })),
  };
  map.addSource(SOURCE_ID, { type: 'geojson', data });
  map.addLayer({
    id: LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    paint: {
      'line-color': '#20e3b2',
      'line-width': 2,
      'line-opacity': 0.75,
    },
  });

  return () => {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  };
}

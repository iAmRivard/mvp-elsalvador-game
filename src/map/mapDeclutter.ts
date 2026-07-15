import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { DrivingPresentationMode } from '../game/drivingPresentation';
import { drivingDeclutterMode } from '../game/drivingPresentation';

export type MapLayerPriority =
  | 'navigation'
  | 'road-primary'
  | 'road-secondary'
  | 'area-label'
  | 'street-label'
  | 'poi-important'
  | 'poi-secondary'
  | 'building'
  | 'decorative';

export interface MapDeclutterProfile {
  labelOpacity: Partial<Record<MapLayerPriority, number>>;
  layerVisibility: Partial<Record<MapLayerPriority, boolean>>;
}

export const mapDeclutterProfiles: Readonly<
  Record<'stopped' | 'driving' | 'fast', MapDeclutterProfile>
> = {
  stopped: {
    labelOpacity: {
      navigation: 1,
      'road-primary': 0.95,
      'road-secondary': 0.28,
      'area-label': 1,
      'street-label': 0.9,
      'poi-important': 1,
      'poi-secondary': 1,
      building: 0.72,
      decorative: 0.86,
    },
    layerVisibility: {},
  },
  driving: {
    labelOpacity: {
      navigation: 1,
      'road-primary': 1,
      'road-secondary': 0.18,
      'area-label': 0.58,
      'street-label': 0.22,
      'poi-important': 0.9,
      'poi-secondary': 0.06,
      building: 0.3,
      decorative: 0.62,
    },
    layerVisibility: {},
  },
  fast: {
    labelOpacity: {
      navigation: 1,
      'road-primary': 1,
      'area-label': 0.4,
      'poi-important': 0.8,
      decorative: 0.5,
    },
    layerVisibility: {
      'road-secondary': false,
      'street-label': false,
      'poi-secondary': false,
      building: false,
    },
  },
};

export interface MapLayerInventoryEntry {
  id: string;
  type: LayerSpecification['type'];
  priority: MapLayerPriority;
}

const navigationLayerPrefixes = [
  'active-mission-',
  'road-debug-',
  'playable-road-',
];

export function classifyMapLayer(
  layer: Pick<LayerSpecification, 'id' | 'type'> & {
    'source-layer'?: string;
  },
): MapLayerPriority {
  const id = layer.id.toLowerCase();
  const sourceLayer = layer['source-layer']?.toLowerCase() ?? '';
  if (navigationLayerPrefixes.some((prefix) => id.startsWith(prefix))) {
    return 'navigation';
  }
  if (id === 'roads' || id === 'roads-casing') return 'road-primary';
  if (id.includes('local-road')) return 'road-secondary';
  if (id.includes('building') || sourceLayer.includes('building')) {
    return 'building';
  }
  if (layer.type === 'symbol') {
    if (id.includes('poi-important')) return 'poi-important';
    if (id.includes('poi') || sourceLayer.includes('poi')) {
      return 'poi-secondary';
    }
    if (id.includes('street') || id.includes('road-label')) {
      return 'street-label';
    }
    return 'area-label';
  }
  return 'decorative';
}

export function mapLayerInventory(
  layers: readonly LayerSpecification[],
): MapLayerInventoryEntry[] {
  return layers.map((layer) => ({
    id: layer.id,
    type: layer.type,
    priority: classifyMapLayer(layer),
  }));
}

function opacityProperty(
  type: LayerSpecification['type'],
): 'text-opacity' | 'line-opacity' | 'fill-opacity' | null {
  if (type === 'symbol') return 'text-opacity';
  if (type === 'line') return 'line-opacity';
  if (type === 'fill') return 'fill-opacity';
  return null;
}

export interface MapDeclutterController {
  apply: (mode: DrivingPresentationMode, immediate?: boolean) => void;
  dispose: () => void;
  inventory: readonly MapLayerInventoryEntry[];
}

export function createMapDeclutterController(
  map: MapLibreMap,
  debounceMilliseconds = 300,
): MapDeclutterController {
  const inventory = mapLayerInventory(map.getStyle().layers ?? []);
  let activeProfile: 'stopped' | 'driving' | 'fast' | null = null;
  let pendingProfile: 'stopped' | 'driving' | 'fast' | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const missing = new Set<string>();

  const commit = (profileName: 'stopped' | 'driving' | 'fast') => {
    const startedAt = performance.now();
    const profile = mapDeclutterProfiles[profileName];
    let visibleLayerCount = 0;
    for (const layer of inventory) {
      if (!map.getLayer(layer.id)) {
        missing.add(layer.id);
        continue;
      }
      const visible = profile.layerVisibility[layer.priority] !== false;
      try {
        map.setLayoutProperty(
          layer.id,
          'visibility',
          visible ? 'visible' : 'none',
        );
        if (visible) visibleLayerCount += 1;
        const opacity = profile.labelOpacity[layer.priority];
        const property = opacityProperty(layer.type);
        if (property && opacity !== undefined) {
          map.setPaintProperty(layer.id, property, opacity);
          if (layer.type === 'symbol') {
            map.setPaintProperty(layer.id, 'icon-opacity', opacity);
          }
        }
      } catch {
        missing.add(layer.id);
      }
    }
    activeProfile = profileName;
    pendingProfile = null;
    const container = map.getContainer();
    container.dataset.mapDeclutterProfile = profileName;
    container.dataset.mapLayerCount = String(inventory.length);
    container.dataset.mapVisibleLayerCount = String(visibleLayerCount);
    container.dataset.mapMissingLayerCount = String(missing.size);
    container.dataset.mapDeclutterChangeMs = (
      performance.now() - startedAt
    ).toFixed(2);
  };

  return {
    inventory,
    apply(mode, immediate = false) {
      const profile = drivingDeclutterMode(mode);
      if (profile === activeProfile || profile === pendingProfile) return;
      pendingProfile = profile;
      if (timer) clearTimeout(timer);
      if (immediate) {
        commit(profile);
        return;
      }
      timer = setTimeout(
        () => {
          timer = null;
          if (pendingProfile) commit(pendingProfile);
        },
        Math.max(250, Math.min(400, debounceMilliseconds)),
      );
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      pendingProfile = null;
    },
  };
}

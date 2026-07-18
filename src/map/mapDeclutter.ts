import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { MapDetailMode } from '../game/mapDetailMode';

export type MapLayerPriority =
  | 'navigation'
  | 'road-primary'
  | 'road-secondary'
  | 'area-major'
  | 'area-local'
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
  Record<MapDetailMode, MapDeclutterProfile>
> = {
  exploration: {
    // Reference values remain useful for diagnostics; the controller restores
    // the captured style instead of applying these generic values.
    labelOpacity: {
      navigation: 1,
      'road-primary': 0.95,
      'road-secondary': 0.28,
      'area-major': 1,
      'area-local': 1,
      'street-label': 0.9,
      'poi-important': 1,
      'poi-secondary': 1,
      building: 0.72,
      decorative: 0.86,
    },
    layerVisibility: {},
  },
  'arcade-driving': {
    labelOpacity: {
      'road-primary': 1,
      'road-secondary': 0.18,
      'area-major': 0.72,
      building: 0.3,
      decorative: 0.62,
    },
    layerVisibility: {
      'area-local': false,
      'street-label': false,
      'poi-secondary': false,
      building: false,
    },
  },
  'arcade-fast': {
    labelOpacity: {
      'road-primary': 1,
      'area-major': 0.48,
      decorative: 0.5,
    },
    layerVisibility: {
      'road-secondary': false,
      'area-local': false,
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

export interface OriginalLayerPresentation {
  visibility?: unknown;
  textOpacity?: unknown;
  iconOpacity?: unknown;
  lineOpacity?: unknown;
  fillOpacity?: unknown;
  circleOpacity?: unknown;
  fillExtrusionOpacity?: unknown;
  rasterOpacity?: unknown;
}

interface LayerSnapshot {
  type: LayerSpecification['type'];
  presentation: OriginalLayerPresentation;
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
    if (id.includes('place-labels-local')) return 'area-local';
    return 'area-major';
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

const paintPropertyByPresentationKey = {
  textOpacity: 'text-opacity',
  iconOpacity: 'icon-opacity',
  lineOpacity: 'line-opacity',
  fillOpacity: 'fill-opacity',
  circleOpacity: 'circle-opacity',
  fillExtrusionOpacity: 'fill-extrusion-opacity',
  rasterOpacity: 'raster-opacity',
} as const;

type PaintPresentationKey = keyof typeof paintPropertyByPresentationKey;

function opacityKeys(
  type: LayerSpecification['type'],
): readonly PaintPresentationKey[] {
  if (type === 'symbol') return ['textOpacity', 'iconOpacity'];
  if (type === 'line') return ['lineOpacity'];
  if (type === 'fill') return ['fillOpacity'];
  if (type === 'circle') return ['circleOpacity'];
  if (type === 'fill-extrusion') return ['fillExtrusionOpacity'];
  if (type === 'raster') return ['rasterOpacity'];
  return [];
}

function readOriginalPresentation(
  map: MapLibreMap,
  layer: MapLayerInventoryEntry,
): OriginalLayerPresentation {
  const presentation: OriginalLayerPresentation = {
    visibility: map.getLayoutProperty(layer.id, 'visibility'),
  };
  for (const key of opacityKeys(layer.type)) {
    presentation[key] = map.getPaintProperty(
      layer.id,
      paintPropertyByPresentationKey[key],
    );
  }
  return presentation;
}

function restoreLayoutProperty(
  map: MapLibreMap,
  layerId: string,
  value: unknown,
): void {
  map.setLayoutProperty(layerId, 'visibility', value ?? null);
}

function restorePaintProperty(
  map: MapLibreMap,
  layerId: string,
  property: string,
  value: unknown,
): void {
  map.setPaintProperty(layerId, property, value ?? null);
}

export interface MapDeclutterController {
  apply: (mode: MapDetailMode, immediate?: boolean) => void;
  refresh: (immediate?: boolean) => void;
  dispose: () => void;
  readonly inventory: readonly MapLayerInventoryEntry[];
}

export function createMapDeclutterController(
  map: MapLibreMap,
  debounceMilliseconds = 300,
): MapDeclutterController {
  let inventory = mapLayerInventory(map.getStyle().layers ?? []);
  const snapshots = new Map<string, LayerSnapshot>();
  const knownLayerIds = new Set(inventory.map((layer) => layer.id));
  let activeProfile: MapDetailMode | null = null;
  let pendingProfile: MapDetailMode | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inventorySignature = inventory
    .map((layer) => `${layer.id}:${layer.type}:${layer.priority}`)
    .join('|');
  let inventoryDirty = false;
  let styleRevision = 0;
  let disposed = false;

  const refreshInventory = () => {
    const nextInventory = mapLayerInventory(map.getStyle().layers ?? []);
    const nextSignature = nextInventory
      .map((layer) => `${layer.id}:${layer.type}:${layer.priority}`)
      .join('|');
    const changed = nextSignature !== inventorySignature;
    inventory = nextInventory;
    for (const layer of inventory) knownLayerIds.add(layer.id);
    inventorySignature = nextSignature;
    inventoryDirty = false;
    if (changed) styleRevision += 1;
    return changed;
  };

  const snapshotFor = (layer: MapLayerInventoryEntry): LayerSnapshot => {
    const current = snapshots.get(layer.id);
    if (current?.type === layer.type) return current;
    const snapshot = {
      type: layer.type,
      presentation: readOriginalPresentation(map, layer),
    };
    snapshots.set(layer.id, snapshot);
    return snapshot;
  };

  const restoreLayer = (
    layer: MapLayerInventoryEntry,
    snapshot: LayerSnapshot,
  ) => {
    restoreLayoutProperty(map, layer.id, snapshot.presentation.visibility);
    for (const key of opacityKeys(layer.type)) {
      restorePaintProperty(
        map,
        layer.id,
        paintPropertyByPresentationKey[key],
        snapshot.presentation[key],
      );
    }
  };

  const commit = (profileName: MapDetailMode) => {
    if (disposed) return;
    const startedAt = performance.now();
    const inventoryChanged = inventoryDirty ? refreshInventory() : false;
    if (profileName === activeProfile && !inventoryChanged) {
      pendingProfile = null;
      return;
    }
    const profile = mapDeclutterProfiles[profileName];
    const currentIds = new Set(inventory.map((layer) => layer.id));
    for (const id of knownLayerIds) {
      if (!currentIds.has(id)) snapshots.delete(id);
    }
    let visibleLayerCount = 0;
    let visibleSymbolLayerCount = 0;
    let failedLayerCount = 0;

    for (const layer of inventory) {
      if (!map.getLayer(layer.id)) {
        failedLayerCount += 1;
        continue;
      }
      try {
        const snapshot = snapshotFor(layer);
        if (profileName === 'exploration') {
          restoreLayer(layer, snapshot);
        } else {
          const visible = profile.layerVisibility[layer.priority] !== false;
          if (visible) {
            restoreLayoutProperty(
              map,
              layer.id,
              snapshot.presentation.visibility,
            );
          } else {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
          }

          const opacity = profile.labelOpacity[layer.priority];
          for (const key of opacityKeys(layer.type)) {
            if (opacity === undefined) {
              restorePaintProperty(
                map,
                layer.id,
                paintPropertyByPresentationKey[key],
                snapshot.presentation[key],
              );
            } else {
              map.setPaintProperty(
                layer.id,
                paintPropertyByPresentationKey[key],
                opacity,
              );
            }
          }
        }
        const originalVisibility = snapshot.presentation.visibility;
        const profileHidesLayer =
          profileName !== 'exploration' &&
          profile.layerVisibility[layer.priority] === false;
        if (!profileHidesLayer && originalVisibility !== 'none') {
          visibleLayerCount += 1;
          if (layer.type === 'symbol') visibleSymbolLayerCount += 1;
        }
      } catch {
        failedLayerCount += 1;
      }
    }

    const removedLayerCount = [...knownLayerIds].filter(
      (id) => !currentIds.has(id),
    ).length;
    activeProfile = profileName;
    pendingProfile = null;
    const container = map.getContainer();
    container.dataset.mapDeclutterProfile = profileName;
    container.dataset.mapPoiVisibility =
      profileName !== 'exploration' &&
      profile.layerVisibility['poi-secondary'] === false
        ? 'none'
        : 'visible';
    container.dataset.mapLocalPlaceVisibility =
      profileName !== 'exploration' &&
      profile.layerVisibility['area-local'] === false
        ? 'none'
        : 'visible';
    container.dataset.mapMajorPlaceVisibility =
      profileName !== 'exploration' &&
      profile.layerVisibility['area-major'] === false
        ? 'none'
        : 'visible';
    container.dataset.mapVisibleSymbolLayerCount = String(
      visibleSymbolLayerCount,
    );
    container.dataset.mapStyleRevision = String(styleRevision);
    container.dataset.mapLayerCount = String(inventory.length);
    container.dataset.mapVisibleLayerCount = String(visibleLayerCount);
    container.dataset.mapMissingLayerCount = String(
      removedLayerCount + failedLayerCount,
    );
    container.dataset.mapDeclutterChangeMs = (
      performance.now() - startedAt
    ).toFixed(2);
  };

  const schedule = (profile: MapDetailMode, immediate: boolean) => {
    pendingProfile = profile;
    if (timer) clearTimeout(timer);
    timer = null;
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
  };

  const handleStyleData = () => {
    if (disposed) return;
    inventoryDirty = true;
    if (activeProfile) schedule(activeProfile, false);
  };
  const eventMap = map as MapLibreMap & {
    on?: (event: 'styledata', listener: () => void) => unknown;
    off?: (event: 'styledata', listener: () => void) => unknown;
  };
  eventMap.on?.('styledata', handleStyleData);

  const controller: MapDeclutterController = {
    get inventory() {
      return inventory;
    },
    apply(mode, immediate = false) {
      if (disposed) return;
      const profile = mode;
      if (
        !inventoryDirty &&
        (profile === activeProfile || profile === pendingProfile)
      )
        return;
      schedule(profile, immediate);
    },
    refresh(immediate = false) {
      if (disposed) return;
      inventoryDirty = true;
      if (activeProfile) schedule(activeProfile, immediate);
    },
    dispose() {
      disposed = true;
      eventMap.off?.('styledata', handleStyleData);
      if (timer) clearTimeout(timer);
      timer = null;
      pendingProfile = null;
    },
  };
  return controller;
}

import { describe, expect, it } from 'vitest';
import type { LayerSpecification } from 'maplibre-gl';
import {
  classifyMapLayer,
  mapDeclutterProfiles,
  mapLayerInventory,
} from '../src/map/mapDeclutter';
import { drivingDeclutterMode } from '../src/game/drivingPresentation';

describe('declutter dinámico del mapa', () => {
  it('clasifica capas base y de navegación', () => {
    const layers = [
      { id: 'roads', type: 'line' },
      { id: 'local-roads', type: 'line' },
      { id: 'poi-labels', type: 'symbol', 'source-layer': 'pois' },
      { id: 'buildings', type: 'fill' },
      { id: 'active-mission-route-road', type: 'line' },
    ] as LayerSpecification[];
    expect(mapLayerInventory(layers).map((layer) => layer.priority)).toEqual([
      'road-primary',
      'road-secondary',
      'poi-secondary',
      'building',
      'navigation',
    ]);
    expect(classifyMapLayer({ id: 'place-labels', type: 'symbol' })).toBe(
      'area-label',
    );
  });

  it('mantiene navegación y oculta detalle secundario al ir rápido', () => {
    expect(mapDeclutterProfiles.fast.layerVisibility.navigation).not.toBe(
      false,
    );
    expect(mapDeclutterProfiles.fast.layerVisibility['poi-secondary']).toBe(
      false,
    );
    expect(mapDeclutterProfiles.fast.layerVisibility['road-secondary']).toBe(
      false,
    );
    expect(
      mapDeclutterProfiles.driving.labelOpacity['poi-secondary'],
    ).toBeLessThan(mapDeclutterProfiles.stopped.labelOpacity['poi-secondary']!);
  });

  it('conserva declutter de conducción durante una alerta', () => {
    expect(drivingDeclutterMode('alert')).toBe('driving');
  });
});

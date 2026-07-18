import { describe, expect, it } from 'vitest';
import type { LayerSpecification } from 'maplibre-gl';
import {
  classifyMapLayer,
  mapDeclutterProfiles,
  mapLayerInventory,
} from '../src/map/mapDeclutter';

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
    expect(classifyMapLayer({ id: 'place-labels-major', type: 'symbol' })).toBe(
      'area-major',
    );
    expect(classifyMapLayer({ id: 'place-labels-local', type: 'symbol' })).toBe(
      'area-local',
    );
  });

  it('mantiene navegación y oculta POI y lugares locales al conducir', () => {
    expect(
      mapDeclutterProfiles['arcade-fast'].layerVisibility.navigation,
    ).not.toBe(false);
    expect(
      mapDeclutterProfiles['arcade-driving'].layerVisibility['poi-secondary'],
    ).toBe(false);
    expect(
      mapDeclutterProfiles['arcade-driving'].layerVisibility['area-local'],
    ).toBe(false);
    expect(
      mapDeclutterProfiles['arcade-driving'].layerVisibility['area-major'],
    ).not.toBe(false);
    expect(
      mapDeclutterProfiles['arcade-fast'].layerVisibility['poi-secondary'],
    ).toBe(false);
    expect(
      mapDeclutterProfiles['arcade-fast'].layerVisibility['road-secondary'],
    ).toBe(false);
    expect(
      mapDeclutterProfiles['arcade-driving'].labelOpacity.navigation,
    ).toBeUndefined();
  });
});

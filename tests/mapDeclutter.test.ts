import { describe, expect, it } from 'vitest';
import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import {
  classifyMapLayer,
  createMapDeclutterController,
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

  it('publica la visibilidad efectiva y denuncia una mutación fallida', () => {
    const layers = [
      { id: 'place-labels-major', type: 'symbol' },
      { id: 'place-labels-local', type: 'symbol' },
      { id: 'poi-labels', type: 'symbol' },
    ] as LayerSpecification[];
    const visibility = new Map(layers.map((layer) => [layer.id, 'visible']));
    const container = { dataset: {} as Record<string, string> };
    const map = {
      getStyle: () => ({ layers }),
      getContainer: () => container,
      getLayer: (id: string) => layers.find((layer) => layer.id === id),
      getLayoutProperty: (id: string) => visibility.get(id),
      getPaintProperty: () => 1,
      setPaintProperty: () => undefined,
      setLayoutProperty: (id: string, _property: string, value: unknown) => {
        if (id === 'poi-labels' && value === 'none') {
          throw new Error('fallo MapLibre simulado');
        }
        visibility.set(id, typeof value === 'string' ? value : 'visible');
      },
      on: () => undefined,
      off: () => undefined,
    } as unknown as MapLibreMap;

    const controller = createMapDeclutterController(map, 0);
    controller.apply('arcade-driving', true);

    expect(container.dataset.mapPoiVisibility).toBe('missing');
    expect(container.dataset.mapLocalPlaceVisibility).toBe('none');
    expect(container.dataset.mapMajorPlaceVisibility).toBe('visible');
    expect(container.dataset.mapMissingLayerCount).toBe('1');
    controller.dispose();
  });
});

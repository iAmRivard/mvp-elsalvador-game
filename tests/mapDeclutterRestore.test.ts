import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { createMapDeclutterController } from '../src/map/mapDeclutter';

interface MutableStyleLayer {
  id: string;
  type: LayerSpecification['type'];
  source?: string;
}

function fakeMap(initialLayers: MutableStyleLayer[]) {
  const layers = [...initialLayers];
  const layout = new Map<string, Map<string, unknown>>();
  const paint = new Map<string, Map<string, unknown>>();
  const container = { dataset: {} } as HTMLDivElement;
  let getStyleCalls = 0;
  let layoutUpdates = 0;
  let paintUpdates = 0;
  const ensure = (
    collection: Map<string, Map<string, unknown>>,
    id: string,
  ) => {
    const properties = collection.get(id) ?? new Map<string, unknown>();
    collection.set(id, properties);
    return properties;
  };
  const map = {
    getStyle: () => {
      getStyleCalls += 1;
      return { layers };
    },
    getLayer: (id: string) => layers.find((layer) => layer.id === id),
    getLayoutProperty: (id: string, property: string) =>
      ensure(layout, id).get(property),
    setLayoutProperty: (id: string, property: string, value: unknown) => {
      layoutUpdates += 1;
      if (!layers.some((layer) => layer.id === id)) throw new Error('missing');
      const properties = ensure(layout, id);
      if (value === null) properties.delete(property);
      else properties.set(property, value);
    },
    getPaintProperty: (id: string, property: string) =>
      ensure(paint, id).get(property),
    setPaintProperty: (id: string, property: string, value: unknown) => {
      paintUpdates += 1;
      if (!layers.some((layer) => layer.id === id)) throw new Error('missing');
      const properties = ensure(paint, id);
      if (value === null) properties.delete(property);
      else properties.set(property, value);
    },
    getContainer: () => container,
  } as unknown as MapLibreMap;
  return {
    map,
    layers,
    layout,
    paint,
    container,
    ensure,
    getStyleCalls: () => getStyleCalls,
    updateCalls: () => layoutUpdates + paintUpdates,
  };
}

afterEach(() => vi.useRealTimers());

describe('restauraciÃ³n exacta del declutter', () => {
  it('restaura nÃºmeros, expresiones y propiedades originalmente ausentes', () => {
    const fixture = fakeMap([
      { id: 'roads', type: 'line', source: 'map' },
      { id: 'poi-labels', type: 'symbol', source: 'map' },
      { id: 'land', type: 'fill', source: 'map' },
      { id: 'points', type: 'circle', source: 'map' },
      { id: 'buildings-3d', type: 'fill-extrusion', source: 'map' },
      { id: 'satellite', type: 'raster', source: 'map' },
    ]);
    const expression = ['interpolate', ['linear'], ['zoom'], 8, 0.2, 14, 0.9];
    fixture.ensure(fixture.layout, 'roads').set('visibility', 'visible');
    fixture.ensure(fixture.paint, 'roads').set('line-opacity', 0.47);
    fixture.ensure(fixture.paint, 'poi-labels').set('text-opacity', expression);
    fixture.ensure(fixture.paint, 'poi-labels').set('icon-opacity', 0.73);
    fixture.ensure(fixture.paint, 'land').set('fill-opacity', 0.34);
    fixture
      .ensure(fixture.paint, 'buildings-3d')
      .set('fill-extrusion-opacity', ['case', true, 0.8, 0.1]);
    fixture.ensure(fixture.paint, 'satellite').set('raster-opacity', 0.61);

    const controller = createMapDeclutterController(fixture.map, 300);
    controller.apply('exploration', true);
    controller.apply('arcade-driving', true);
    controller.apply('arcade-fast', true);
    expect(fixture.ensure(fixture.paint, 'roads').get('line-opacity')).toBe(1);
    expect(fixture.ensure(fixture.layout, 'poi-labels').get('visibility')).toBe(
      'none',
    );

    controller.apply('exploration', true);
    expect(fixture.ensure(fixture.layout, 'roads').get('visibility')).toBe(
      'visible',
    );
    expect(fixture.ensure(fixture.paint, 'roads').get('line-opacity')).toBe(
      0.47,
    );
    expect(
      fixture.ensure(fixture.paint, 'poi-labels').get('text-opacity'),
    ).toBe(expression);
    expect(
      fixture.ensure(fixture.paint, 'poi-labels').get('icon-opacity'),
    ).toBe(0.73);
    expect(fixture.ensure(fixture.paint, 'land').get('fill-opacity')).toBe(
      0.34,
    );
    expect(fixture.ensure(fixture.paint, 'points').has('circle-opacity')).toBe(
      false,
    );
    expect(
      fixture
        .ensure(fixture.paint, 'buildings-3d')
        .get('fill-extrusion-opacity'),
    ).toEqual(['case', true, 0.8, 0.1]);
    expect(
      fixture.ensure(fixture.paint, 'satellite').get('raster-opacity'),
    ).toBe(0.61);
  });

  it('tolera capas eliminadas y captura capas agregadas despuÃ©s del inicio', () => {
    const fixture = fakeMap([{ id: 'roads', type: 'line' }]);
    fixture.ensure(fixture.paint, 'roads').set('line-opacity', 0.5);
    const controller = createMapDeclutterController(fixture.map);
    controller.apply('exploration', true);
    fixture.layers.splice(0, 1);
    fixture.layers.push({ id: 'local-road-new', type: 'line' });
    fixture
      .ensure(fixture.paint, 'local-road-new')
      .set('line-opacity', ['match', ['get', 'kind'], 'road', 0.7, 0.2]);
    controller.refresh(true);

    expect(() => controller.apply('arcade-fast', true)).not.toThrow();
    expect(
      fixture.ensure(fixture.layout, 'local-road-new').get('visibility'),
    ).toBe('none');
    expect(fixture.container.dataset.mapMissingLayerCount).toBe('1');
    controller.apply('exploration', true);
    expect(
      fixture.ensure(fixture.layout, 'local-road-new').has('visibility'),
    ).toBe(false);
    expect(
      fixture.ensure(fixture.paint, 'local-road-new').get('line-opacity'),
    ).toEqual(['match', ['get', 'kind'], 'road', 0.7, 0.2]);

    fixture.layers.splice(0, 1);
    controller.refresh(true);
    controller.apply('arcade-fast', true);
    fixture.layers.push({ id: 'local-road-new', type: 'line' });
    fixture.ensure(fixture.paint, 'local-road-new').set('line-opacity', 0.81);
    controller.refresh(true);
    controller.apply('arcade-driving', true);
    controller.apply('exploration', true);
    expect(
      fixture.ensure(fixture.paint, 'local-road-new').get('line-opacity'),
    ).toBe(0.81);
  });

  it('aplica solo el Ãºltimo cambio rÃ¡pido y cancela timers al disponer', () => {
    vi.useFakeTimers();
    const fixture = fakeMap([{ id: 'poi-labels', type: 'symbol' }]);
    const controller = createMapDeclutterController(fixture.map, 300);
    controller.apply('arcade-driving');
    controller.apply('arcade-fast');
    vi.advanceTimersByTime(300);
    expect(fixture.container.dataset.mapDeclutterProfile).toBe('arcade-fast');

    controller.apply('arcade-driving');
    controller.dispose();
    vi.runAllTimers();
    expect(fixture.container.dataset.mapDeclutterProfile).toBe('arcade-fast');
  });

  it('no vuelve a consultar ni actualizar el estilo para el mismo modo', () => {
    const fixture = fakeMap([
      { id: 'place-labels-major', type: 'symbol' },
      { id: 'place-labels-local', type: 'symbol' },
      { id: 'poi-labels', type: 'symbol' },
    ]);
    const controller = createMapDeclutterController(fixture.map);
    controller.apply('arcade-driving', true);
    const styleCalls = fixture.getStyleCalls();
    const updateCalls = fixture.updateCalls();

    controller.apply('arcade-driving', true);

    expect(fixture.getStyleCalls()).toBe(styleCalls);
    expect(fixture.updateCalls()).toBe(updateCalls);
    expect(fixture.container.dataset.mapVisibleSymbolLayerCount).toBe('1');
  });
});

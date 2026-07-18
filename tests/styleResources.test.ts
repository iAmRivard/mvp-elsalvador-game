import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createStyleResourceTransform } from '../src/map/styleResources';

describe('recursos del estilo cartografico', () => {
  it('separa lugares mayores y locales en capas independientes', () => {
    const style = JSON.parse(
      readFileSync(
        new URL(
          '../public/map-assets/styles/el-salvador.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as { layers: Array<{ id: string; filter?: unknown }> };
    const byId = new Map(style.layers.map((layer) => [layer.id, layer]));

    expect(byId.has('place-labels')).toBe(false);
    expect(byId.get('place-labels-major')?.filter).toContainEqual([
      'literal',
      ['city', 'town'],
    ]);
    expect(byId.get('place-labels-local')?.filter).toContainEqual([
      'literal',
      ['village', 'municipality'],
    ]);
    expect(byId.has('poi-labels')).toBe(true);
  });

  it('convierte sprites y glyphs locales en URLs absolutas', () => {
    const transformStyle = createStyleResourceTransform(
      'https://juego.example.com/',
    );
    const style = transformStyle(undefined, {
      version: 8,
      sources: {},
      layers: [],
      sprite: '/map-assets/sprites/basemap',
      glyphs: '/map-assets/fonts/{fontstack}/{range}.pbf',
    });

    expect(style.sprite).toBe(
      'https://juego.example.com/map-assets/sprites/basemap',
    );
    expect(style.glyphs).toBe(
      'https://juego.example.com/map-assets/fonts/{fontstack}/{range}.pbf',
    );
  });

  it('reescribe la fuente primaria con el mismo PMTiles configurado', () => {
    const transformStyle = createStyleResourceTransform(
      'https://juego.example.com/',
      {
        sourceId: 'el-salvador',
        archiveUrl: '/maps/alternate.pmtiles',
      },
    );
    const style = transformStyle(undefined, {
      version: 8,
      sources: {
        'el-salvador': {
          type: 'vector',
          url: 'pmtiles:///maps/el-salvador.pmtiles',
        },
        landmarks: {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        },
      },
      layers: [],
    });

    expect(style.sources?.['el-salvador']).toMatchObject({
      type: 'vector',
      url: 'pmtiles:///maps/alternate.pmtiles',
    });
    expect(style.sources?.landmarks).toMatchObject({ type: 'geojson' });
  });
});

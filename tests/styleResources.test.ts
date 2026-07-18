import { describe, expect, it } from 'vitest';
import { createStyleResourceTransform } from '../src/map/styleResources';

describe('recursos del estilo cartografico', () => {
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
        landmarks: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
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

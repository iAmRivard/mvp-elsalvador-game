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
});

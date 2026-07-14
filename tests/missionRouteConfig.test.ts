import { describe, expect, it } from 'vitest';
import {
  missionRouteColors,
  missionRouteStyle,
} from '../src/config/missionRoute.config';

describe('contraste de la ruta de misión', () => {
  it('diferencia ruta, tramo inmediato, fallback y objetivo', () => {
    expect(missionRouteColors).toEqual({
      casing: '#06242C',
      road: '#28D7F5',
      immediate: '#D8FBFF',
      fallback: '#FF9F43',
      target: '#FFE169',
    });
    expect(new Set(Object.values(missionRouteColors)).size).toBe(5);
  });

  it('mantiene el tramo inmediato y el borde más anchos que la ruta', () => {
    expect(missionRouteStyle.casingWidth).toBeGreaterThan(
      missionRouteStyle.roadWidth,
    );
    expect(missionRouteStyle.immediateWidth).toBeGreaterThan(
      missionRouteStyle.roadWidth,
    );
    expect(missionRouteStyle.roadOpacity).toBe(0.95);
  });
});

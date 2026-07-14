import { describe, expect, it } from 'vitest';
import {
  layoutLocationMarkers,
  locationLabelModeForZoom,
  shortLocationName,
  type LocationMarkerLayoutInput,
} from '../src/map/locationMarkerLayout';

function marker(
  id: string,
  x: number,
  y: number,
  overrides: Partial<LocationMarkerLayoutInput> = {},
): LocationMarkerLayoutInput {
  return {
    id,
    name: `Lugar ${id}`,
    type: 'town',
    point: { x, y },
    unlocked: true,
    discovered: false,
    mission: false,
    selected: false,
    ...overrides,
  };
}

describe('layout de marcadores generales', () => {
  it('oculta textos lejos y cambia de nombre corto a detalle por zoom', () => {
    expect(locationLabelModeForZoom(7.5)).toBe('none');
    expect(locationLabelModeForZoom(9)).toBe('short');
    expect(locationLabelModeForZoom(12)).toBe('full');

    const result = layoutLocationMarkers(
      [marker('tunco', 200, 180)],
      { width: 400, height: 400 },
      8,
      0,
    );
    expect(result[0].labelMode).toBe('none');
  });

  it('prioriza misión y limita las etiquetas de zoom medio a seis', () => {
    const markers = Array.from({ length: 9 }, (_, index) =>
      marker(String(index), 30 + index * 90, 100, {
        mission: index === 8,
        type: index === 0 ? 'city' : 'town',
      }),
    );
    const result = layoutLocationMarkers(
      markers,
      { width: 900, height: 300 },
      9.5,
      0,
    );
    expect(result.filter(({ labelMode }) => labelMode !== 'none')).toHaveLength(
      6,
    );
    expect(result[8].labelMode).toBe('short');
  });

  it('oculta la etiqueta de menor prioridad cuando colisionan', () => {
    const result = layoutLocationMarkers(
      [
        marker('normal', 200, 180),
        marker('mission', 202, 181, { mission: true }),
      ],
      { width: 500, height: 400 },
      12,
      20,
    );
    expect(result.find(({ id }) => id === 'mission')?.labelMode).toBe('full');
    expect(result.find(({ id }) => id === 'normal')?.labelMode).toBe('none');
  });

  it('mantiene etiquetas dentro del viewport mediante clamping', () => {
    const [result] = layoutLocationMarkers(
      [marker('edge', 392, 392, { name: 'Volcán de Santa Ana' })],
      { width: 400, height: 400, padding: 8 },
      12,
      0,
    );
    expect(result.labelOffset.x).toBeLessThan(0);
    expect(result.labelOffset.y).toBeLessThan(0);
    expect(392 + result.labelOffset.x).toBeGreaterThanOrEqual(8);
    expect(392 + result.labelOffset.y).toBeGreaterThanOrEqual(8);
  });

  it('aumenta el offset con pitch sin separar el texto de su punto', () => {
    const input = [marker('coast', 16, 130, { type: 'beach' })];
    const flat = layoutLocationMarkers(
      input,
      { width: 420, height: 300 },
      12,
      0,
    )[0];
    const pitched = layoutLocationMarkers(
      input,
      { width: 420, height: 300 },
      12,
      60,
    )[0];
    expect(pitched.labelOffset.y).toBeGreaterThan(flat.labelOffset.y);
    expect(
      Math.hypot(pitched.labelOffset.x, pitched.labelOffset.y),
    ).toBeLessThan(80);
  });

  it('abrevia nombres descriptivos sin perder el lugar', () => {
    expect(shortLocationName('Estación abandonada de El Congo')).toBe(
      'El Congo',
    );
    expect(shortLocationName('Lago de Coatepeque')).toBe('Coatepeque');
  });
});

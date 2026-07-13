import { describe, expect, it } from 'vitest';
import {
  mercatorScaleForScreenSize,
  normalizedHeadingRadians,
  shouldUseThreePlayer,
  threePlayerTargetPixels,
} from '../src/map/threeTransforms';

describe('transformaciones de la capa 3D', () => {
  it('normaliza el rumbo como una rotación horaria sobre el mapa', () => {
    expect(normalizedHeadingRadians(90)).toBeCloseTo(Math.PI / 2);
    expect(normalizedHeadingRadians(-90)).toBeCloseTo((Math.PI * 3) / 2);
    expect(normalizedHeadingRadians(450)).toBeCloseTo(Math.PI / 2);
  });

  it('conserva un tamaño de pantalla estable entre niveles de zoom', () => {
    const scaleAtTen = mercatorScaleForScreenSize(10, 40, 5);
    const scaleAtEleven = mercatorScaleForScreenSize(11, 40, 5);
    expect(scaleAtEleven).toBeCloseTo(scaleAtTen / 2);
  });

  it('reserva Three.js para calidad media o alta', () => {
    expect(shouldUseThreePlayer(true, 'low')).toBe(false);
    expect(shouldUseThreePlayer(true, 'medium')).toBe(true);
    expect(shouldUseThreePlayer(true, 'high')).toBe(true);
    expect(shouldUseThreePlayer(false, 'high')).toBe(false);
  });

  it('aumenta el tamaño del vehículo en calidad alta', () => {
    expect(threePlayerTargetPixels('high')).toBeGreaterThan(
      threePlayerTargetPixels('medium'),
    );
  });
});

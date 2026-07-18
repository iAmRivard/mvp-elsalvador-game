import { describe, expect, it } from 'vitest';
import {
  smoothVehicleMotionCue,
  vehicleAccelerationCueTarget,
  vehicleSteeringCueTarget,
} from '../src/map/threeVehicleMotion';

describe('señales de movimiento del vehículo 3D', () => {
  it('distingue giros a izquierda y derecha solo con velocidad útil', () => {
    expect(vehicleSteeringCueTarget(0, 3, 8, 50)).toBeGreaterThan(0);
    expect(vehicleSteeringCueTarget(0, 357, 8, 50)).toBeLessThan(0);
    expect(vehicleSteeringCueTarget(0, 3, 0, 50)).toBe(0);
  });

  it('distingue aceleración y frenado con límites normalizados', () => {
    expect(vehicleAccelerationCueTarget(4, 5, 100)).toBeGreaterThan(0);
    expect(vehicleAccelerationCueTarget(5, 4, 100)).toBeLessThan(0);
    expect(vehicleAccelerationCueTarget(0, 20, 16)).toBe(1);
  });

  it('suaviza según tiempo sin sobrepasar el objetivo', () => {
    const short = smoothVehicleMotionCue(0, 1, 16);
    const long = smoothVehicleMotionCue(0, 1, 50);
    expect(short).toBeGreaterThan(0);
    expect(short).toBeLessThan(long);
    expect(long).toBeLessThan(1);
  });
});

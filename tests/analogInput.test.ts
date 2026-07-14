import { describe, expect, it } from 'vitest';
import {
  applyDeadZone,
  applyResponseCurve,
  clampAnalogInput,
} from '../src/game/analogInput';

describe('entrada analógica', () => {
  it('limita valores y neutraliza números no finitos', () => {
    expect(clampAnalogInput(-4)).toBe(-1);
    expect(clampAnalogInput(0.42)).toBe(0.42);
    expect(clampAnalogInput(8)).toBe(1);
    expect(clampAnalogInput(Number.NaN)).toBe(0);
    expect(clampAnalogInput(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('aplica y normaliza una zona muerta segura', () => {
    expect(applyDeadZone(0.1, 0.14)).toBe(0);
    expect(applyDeadZone(-0.14, 0.14)).toBe(0);
    expect(applyDeadZone(1, 0.14)).toBe(1);
    expect(applyDeadZone(-1, 0.14)).toBe(-1);
    expect(applyDeadZone(0.5, 3)).toBe(0);
    expect(applyDeadZone(0.5, Number.NaN)).toBe(0.5);
  });

  it('suaviza valores parciales y conserva los extremos', () => {
    expect(applyResponseCurve(0.5, 1.45)).toBeCloseTo(0.366, 3);
    expect(applyResponseCurve(-0.5, 1.45)).toBeCloseTo(-0.366, 3);
    expect(applyResponseCurve(1, 1.45)).toBe(1);
    expect(applyResponseCurve(0.25, -4)).toBeCloseTo(0.5, 8);
    expect(applyResponseCurve(0.25, Number.NaN)).toBe(0.25);
  });
});

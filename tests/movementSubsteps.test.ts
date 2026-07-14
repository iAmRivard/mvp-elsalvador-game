import { describe, expect, it } from 'vitest';
import {
  calculateMovementSubsteps,
  movementSubstepConfig,
} from '../src/config/movementSubstep.config';

describe('movement substep configuration', () => {
  it('uses one step while the estimated distance stays below the limit', () => {
    expect(calculateMovementSubsteps(9.99)).toBe(1);
    expect(calculateMovementSubsteps(10.01)).toBe(2);
  });

  it('caps processing and normalizes invalid measurements', () => {
    expect(calculateMovementSubsteps(10_000)).toBe(
      movementSubstepConfig.maximumSubstepsPerFrame,
    );
    expect(calculateMovementSubsteps(Number.NaN)).toBe(1);
    expect(
      calculateMovementSubsteps(100, {
        maximumGeographicStepMeters: 0,
        maximumSubstepsPerFrame: 0,
        maximumDeltaTimeSeconds: 0.25,
      }),
    ).toBe(10);
  });
});

import { describe, expect, it } from 'vitest';
import { driveJoystickConfig } from '../src/config/mobileControls.config';
import { driveJoystickOutput } from '../src/game/driveJoystick';

describe('joystick único de conducción', () => {
  it('acelera arriba y limita la reversa abajo', () => {
    expect(driveJoystickOutput(0, -1)).toEqual({ throttle: 1, turn: 0 });
    expect(driveJoystickOutput(0, 1)).toEqual({
      throttle: -driveJoystickConfig.reverseMaximum,
      turn: 0,
    });
  });

  it('permite acelerar y girar en diagonal', () => {
    const output = driveJoystickOutput(0.75, -0.8);
    expect(output.throttle).toBeGreaterThan(0.5);
    expect(output.turn).toBeGreaterThan(0.5);
  });

  it('aplica zonas muertas horizontal y vertical por separado', () => {
    expect(driveJoystickOutput(0.11, -0.15)).toEqual({
      throttle: 0,
      turn: 0,
    });
    expect(driveJoystickOutput(0.13, -0.15).turn).toBeGreaterThan(0);
    expect(driveJoystickOutput(0.11, -0.17).throttle).toBeGreaterThan(0);
  });

  it('vuelve a cero en el centro', () => {
    expect(driveJoystickOutput(0, 0)).toEqual({ throttle: 0, turn: 0 });
  });
});

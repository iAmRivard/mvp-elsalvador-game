import { describe, expect, it } from 'vitest';
import { driveJoystickConfig } from '../src/config/mobileControls.config';
import {
  arcadeDriveJoystickOutput,
  driveJoystickOutput,
  legacyDriveJoystickThrottle,
} from '../src/game/driveJoystick';

describe('joystick único de conducción', () => {
  it('separa la intención vertical del giro', () => {
    expect(driveJoystickOutput(0, -1)).toEqual({
      verticalIntent: 1,
      turn: 0,
    });
    expect(driveJoystickOutput(0, 1)).toEqual({
      verticalIntent: -1,
      turn: 0,
    });
  });

  it('permite cambiar marcha y girar cuando domina el eje vertical', () => {
    const output = driveJoystickOutput(0.75, -0.8);
    expect(output.verticalIntent).toBeGreaterThan(0.5);
    expect(output.turn).toBeGreaterThan(0.5);
  });

  it('aísla la marcha cuando el gesto está dominado por dirección', () => {
    const output = driveJoystickOutput(0.8, -0.65);
    expect(output.turn).toBeGreaterThan(0.5);
    expect(output.verticalIntent).toBe(0);
  });

  it('arcade conserva aceleración y giro en una diagonal lateral', () => {
    const output = arcadeDriveJoystickOutput(0.8, -0.65);
    expect(output.turn).toBeGreaterThan(0.5);
    expect(output.verticalIntent).toBeGreaterThan(0.3);
  });

  it('aplica zonas muertas horizontal y vertical por separado', () => {
    expect(driveJoystickOutput(0.11, -0.15)).toEqual({
      verticalIntent: 0,
      turn: 0,
    });
    expect(driveJoystickOutput(0.13, -0.15).turn).toBeGreaterThan(0);
    expect(
      driveJoystickOutput(0.11, -0.17).verticalIntent,
    ).toBeGreaterThan(0);
  });

  it('vuelve a cero en el centro', () => {
    expect(driveJoystickOutput(0, 0)).toEqual({
      verticalIntent: 0,
      turn: 0,
    });
  });

  it('conserva el throttle continuo anterior como modo alternativo', () => {
    expect(legacyDriveJoystickThrottle(-1)).toBe(1);
    expect(legacyDriveJoystickThrottle(1)).toBe(
      -driveJoystickConfig.reverseMaximum,
    );
  });
});

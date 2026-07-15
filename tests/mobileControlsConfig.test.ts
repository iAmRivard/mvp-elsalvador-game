import { describe, expect, it } from 'vitest';
import { controlViewportScale } from '../src/config/mobileControls.config';

describe('escala responsive de controles móviles', () => {
  it('reduce el joystick en viewports bajos sin alterar portrait y tablet', () => {
    expect(controlViewportScale(412)).toBe(0.58);
    expect(controlViewportScale(560)).toBe(0.58);
    expect(controlViewportScale(561)).toBe(1);
    expect(controlViewportScale(640)).toBe(1);
    expect(controlViewportScale(1_024)).toBe(1);
  });
});

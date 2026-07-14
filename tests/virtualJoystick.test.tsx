// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualJoystick } from '../src/components/game/VirtualJoystick';
import { virtualJoystickConfig } from '../src/config/mobileControls.config';
import { InputController } from '../src/game/inputController';

describe('joystick virtual', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.defineProperties(HTMLElement.prototype, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: () => true },
    });
  });

  function setup() {
    const input = new InputController();
    const view = render(
      <VirtualJoystick
        input={input}
        radiusPixels={virtualJoystickConfig.radiusPixels}
        knobRadiusPixels={virtualJoystickConfig.knobRadiusPixels}
        deadZone={virtualJoystickConfig.deadZone}
        responseExponent={virtualJoystickConfig.responseExponent}
        returnDurationMilliseconds={
          virtualJoystickConfig.returnDurationMilliseconds
        }
        positionMode="fixed"
      />,
    );
    const joystick = view.getByLabelText('Joystick de dirección');
    vi.spyOn(joystick, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 144,
      bottom: 144,
      width: 144,
      height: 144,
      toJSON: () => ({}),
    });
    return { input, joystick };
  }

  it('inicia centrado y produce giro parcial continuo', () => {
    const { input, joystick } = setup();
    expect(input.snapshot().turn).toBe(0);

    fireEvent.pointerDown(joystick, {
      pointerId: 3,
      clientX: 72,
      clientY: 72,
    });
    fireEvent.pointerMove(joystick, {
      pointerId: 3,
      clientX: 108,
      clientY: 72,
    });

    expect(input.snapshot().turn).toBeGreaterThan(0.2);
    expect(input.snapshot().turn).toBeLessThan(0.5);
  });

  it('limita el giro y vuelve al centro al liberar', () => {
    const { input, joystick } = setup();
    fireEvent.pointerDown(joystick, {
      pointerId: 5,
      clientX: 72,
      clientY: 72,
    });
    fireEvent.pointerMove(joystick, {
      pointerId: 5,
      clientX: 400,
      clientY: 72,
    });
    expect(input.snapshot().turn).toBe(1);

    fireEvent.pointerUp(joystick, {
      pointerId: 5,
      clientX: 400,
      clientY: 72,
    });
    expect(input.snapshot().turn).toBe(0);
    expect(input.getDiagnostics().pointerActive).toBe(false);
  });

  it('limpia dirección ante cancelación u orientación', () => {
    const { input, joystick } = setup();
    fireEvent.pointerDown(joystick, {
      pointerId: 7,
      clientX: 72,
      clientY: 72,
    });
    fireEvent.pointerMove(joystick, {
      pointerId: 7,
      clientX: 20,
      clientY: 72,
    });
    expect(input.snapshot().turn).toBeLessThan(0);

    fireEvent.pointerCancel(joystick, { pointerId: 7 });
    expect(input.snapshot().turn).toBe(0);

    fireEvent.pointerDown(joystick, {
      pointerId: 8,
      clientX: 72,
      clientY: 72,
    });
    fireEvent.pointerMove(joystick, {
      pointerId: 8,
      clientX: 120,
      clientY: 72,
    });
    window.dispatchEvent(new Event('orientationchange'));
    expect(input.snapshot().turn).toBe(0);
  });
});

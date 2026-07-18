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

  function setup(
    driveMode = false,
    targetSpeedMode = false,
    arcadeMode = false,
  ) {
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
        driveMode={driveMode}
        targetSpeedMode={targetSpeedMode}
        arcadeMode={arcadeMode}
      />,
    );
    const joystick = view.getByLabelText(
      arcadeMode
        ? 'Joystick de conducción arcade'
        : targetSpeedMode
          ? 'Joystick de velocidad objetivo'
          : driveMode
            ? 'Joystick de conducción'
            : 'Joystick de dirección',
    );
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
    return { input, joystick, unmount: view.unmount };
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

  it('controla aceleración y giro diagonal y libera ambos ejes', () => {
    const { input, joystick } = setup(true);
    fireEvent.pointerDown(joystick, {
      pointerId: 9,
      clientX: 72,
      clientY: 72,
    });
    fireEvent.pointerMove(joystick, {
      pointerId: 9,
      clientX: 112,
      clientY: 24,
    });
    expect(input.snapshot().throttle).toBeGreaterThan(0);
    expect(input.snapshot().turn).toBeGreaterThan(0);

    fireEvent.pointerUp(joystick, {
      pointerId: 9,
      clientX: 112,
      clientY: 24,
    });
    expect(input.snapshot()).toMatchObject({ throttle: 0, turn: 0 });
  });

  it('arcade arranca con un gesto corto visible y conserva el crucero al soltar', () => {
    const { input, joystick } = setup(true, true, true);
    input.setMobileCruiseMode('arcade');

    fireEvent.pointerDown(joystick, {
      pointerId: 11,
      clientX: 72,
      clientY: 72,
    });
    fireEvent.pointerMove(joystick, {
      pointerId: 11,
      clientX: 72,
      clientY: 61,
    });

    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(25);

    fireEvent.pointerUp(joystick, {
      pointerId: 11,
      clientX: 72,
      clientY: 61,
    });
    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(25);
  });

  it('arcade arranca con giro lateral pero no con el primer gesto hacia abajo', () => {
    const lateral = setup(true, true, true);
    lateral.input.setMobileCruiseMode('arcade');
    fireEvent.pointerDown(lateral.joystick, {
      pointerId: 12,
      clientX: 72,
      clientY: 72,
    });
    fireEvent.pointerMove(lateral.joystick, {
      pointerId: 12,
      clientX: 92,
      clientY: 72,
    });
    expect(
      lateral.input.getMobileCruiseTarget().targetSpeedKilometersPerHour,
    ).toBe(25);
    lateral.unmount();

    const braking = setup(true, true, true);
    braking.input.setMobileCruiseMode('arcade');
    fireEvent.pointerDown(braking.joystick, {
      pointerId: 13,
      clientX: 72,
      clientY: 72,
    });
    fireEvent.pointerMove(braking.joystick, {
      pointerId: 13,
      clientX: 72,
      clientY: 92,
    });
    expect(
      braking.input.getMobileCruiseTarget().targetSpeedKilometersPerHour,
    ).toBe(0);
  });

  it('cancela el puntero capturado y no rearma Arcade mientras está bloqueado', () => {
    const input = new InputController();
    input.setMobileCruiseMode('arcade');
    const joystickProps = (disabled: boolean) => ({
      input,
      radiusPixels: virtualJoystickConfig.radiusPixels,
      knobRadiusPixels: virtualJoystickConfig.knobRadiusPixels,
      deadZone: virtualJoystickConfig.deadZone,
      responseExponent: virtualJoystickConfig.responseExponent,
      returnDurationMilliseconds:
        virtualJoystickConfig.returnDurationMilliseconds,
      positionMode: 'fixed' as const,
      driveMode: true,
      targetSpeedMode: true,
      arcadeMode: true,
      disabled,
    });
    const view = render(<VirtualJoystick {...joystickProps(false)} />);
    const joystick = view.getByLabelText('Joystick de conducción arcade');
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
    fireEvent.pointerDown(joystick, {
      pointerId: 14,
      clientX: 72,
      clientY: 72,
    });
    fireEvent.pointerMove(joystick, {
      pointerId: 14,
      clientX: 92,
      clientY: 72,
    });
    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(25);

    input.clearAllInput();
    view.rerender(<VirtualJoystick {...joystickProps(true)} />);
    fireEvent.pointerMove(joystick, {
      pointerId: 14,
      clientX: 112,
      clientY: 72,
    });

    expect(input.getDiagnostics().pointerActive).toBe(false);
    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(0);
  });

  it('emite háptica al pasar de freno a reversa cerca de cero', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    });
    const input = new InputController();
    const renderJoystick = (speedMetersPerSecond: number) => (
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
        driveMode
        speedMetersPerSecond={speedMetersPerSecond}
        hapticsEnabled
      />
    );
    const view = render(renderJoystick(5));
    const joystick = view.getByLabelText('Joystick de conducción');
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
    fireEvent.pointerDown(joystick, {
      pointerId: 10,
      clientX: 72,
      clientY: 72,
    });
    fireEvent.pointerMove(joystick, {
      pointerId: 10,
      clientX: 72,
      clientY: 138,
    });
    expect(vibrate).not.toHaveBeenCalled();

    view.rerender(renderJoystick(0.2));
    expect(vibrate).toHaveBeenCalledWith(14);
  });
});

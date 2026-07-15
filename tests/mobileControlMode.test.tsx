// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TouchControls } from '../src/components/game/TouchControls';
import { RecommendedControlsPrompt } from '../src/components/menu/RecommendedControlsPrompt';
import { InputController } from '../src/game/inputController';
import { useGameStore } from '../src/store/gameStore';
import { useSettingsStore } from '../src/store/settingsStore';

describe('modos móviles de conducción', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(cleanup);

  it('deja joystick, Turbo y utilidades sin pedales ni AUTO', () => {
    useSettingsStore.setState({ controlMode: 'single-drive-joystick' });
    render(<TouchControls input={new InputController()} />);

    expect(screen.getByLabelText('Joystick de conducción')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turbo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Acelerar' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Frenar o retroceder' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Activar crucero' }),
    ).toBeNull();
  });

  it('ofrece la migración una vez y conserva la elección', () => {
    useSettingsStore.setState({
      controlMode: 'classic-buttons',
      targetSpeedJoystickPromptDismissed: false,
    });
    render(<RecommendedControlsPrompt />);

    fireEvent.click(screen.getByRole('button', { name: 'Probar' }));
    expect(useSettingsStore.getState()).toMatchObject({
      controlMode: 'target-speed-joystick',
      targetSpeedJoystickPromptDismissed: true,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra el objetivo sin pedales en el modo recomendado', () => {
    useSettingsStore.setState({ controlMode: 'target-speed-joystick' });
    render(<TouchControls input={new InputController()} />);

    expect(
      screen.getByLabelText('Joystick de velocidad objetivo'),
    ).toBeTruthy();
    expect(screen.getByTestId('mobile-cruise-target').textContent).toContain(
      'OBJETIVO 0 km/h',
    );
    expect(screen.queryByRole('button', { name: 'Acelerar' })).toBeNull();
  });

  it('oculta controles con la bitácora y conserva la velocidad elegida', () => {
    useSettingsStore.setState({ controlMode: 'target-speed-joystick' });
    const input = new InputController();
    render(<TouchControls input={input} />);
    act(() => {
      input.setTargetSpeedJoystick(1, 0);
      input.advanceMobileCruise(0, 0.5);
    });
    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(35);

    act(() => useGameStore.getState().openJournal('missions'));
    expect(screen.queryByLabelText('Controles táctiles')).toBeNull();
    expect(input.getMobileCruiseTarget()).toMatchObject({
      targetSpeedKilometersPerHour: 35,
      reversing: false,
    });

    act(() => useGameStore.getState().closeJournal());
    expect(screen.getByLabelText('Controles táctiles')).toBeTruthy();
    expect(input.getMobileCruiseTarget().targetSpeedKilometersPerHour).toBe(35);
  });
});

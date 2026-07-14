// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TouchControls } from '../src/components/game/TouchControls';
import { RecommendedControlsPrompt } from '../src/components/menu/RecommendedControlsPrompt';
import { InputController } from '../src/game/inputController';
import { useGameStore } from '../src/store/gameStore';
import { useSettingsStore } from '../src/store/settingsStore';

describe('modo móvil de joystick único', () => {
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
      singleDriveJoystickPromptDismissed: false,
    });
    render(<RecommendedControlsPrompt />);

    fireEvent.click(screen.getByRole('button', { name: 'Probar modo simple' }));
    expect(useSettingsStore.getState()).toMatchObject({
      controlMode: 'single-drive-joystick',
      singleDriveJoystickPromptDismissed: true,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

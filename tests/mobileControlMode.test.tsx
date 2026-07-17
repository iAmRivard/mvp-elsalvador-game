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
import { StuckVehicleAssist } from '../src/components/game/StuckVehicleAssist';
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
      arcadeDrivingPromptDismissed: false,
    });
    render(<RecommendedControlsPrompt />);

    fireEvent.click(screen.getByRole('button', { name: 'Probar' }));
    expect(useSettingsStore.getState()).toMatchObject({
      controlMode: 'arcade-driving',
      arcadeDrivingPromptDismissed: true,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mantiene la narrativa por encima del aviso no modal de migración', () => {
    useSettingsStore.setState({
      controlMode: 'classic-buttons',
      arcadeDrivingPromptDismissed: false,
    });
    useGameStore.setState({
      activeNarrativeEventId: 'radio-transmision-inicial',
    });
    render(<RecommendedControlsPrompt />);

    expect(screen.queryByText('Conducción Arcade')).toBeNull();
    act(() => useGameStore.setState({ activeNarrativeEventId: null }));
    expect(
      screen.getByRole('status', { name: 'Nuevo control móvil' }),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('no ofrece reintentar aceleración en un modo manual', async () => {
    vi.useFakeTimers();
    useSettingsStore.setState({ controlMode: 'classic-buttons' });
    const input = new InputController();
    input.setDriveJoystick(1, 0);
    render(<StuckVehicleAssist input={input} enabled />);

    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(screen.getByText('Tu vehículo no está avanzando')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Reintentar aceleración' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Cambiar a conducción arcade' }),
    ).toBeTruthy();
    vi.useRealTimers();
  });

  it('muestra Arcade como modo recomendado y engancha 25 km/h', () => {
    useSettingsStore.setState({ controlMode: 'arcade-driving' });
    const input = new InputController();
    render(<TouchControls input={input} />);

    expect(screen.getByLabelText('Joystick de conducción arcade')).toBeTruthy();
    act(() => input.setTargetSpeedJoystick(0.5, 0));
    expect(screen.getByTestId('mobile-cruise-target').textContent).toContain(
      'OBJETIVO 25 km/h',
    );
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

  it('informa en el titulo sin cubrir una sesion de juego activa', () => {
    useSettingsStore.setState({
      controlMode: 'classic-buttons',
      arcadeDrivingPromptDismissed: false,
    });
    const { rerender } = render(
      <RecommendedControlsPrompt gameplayActive={false} />,
    );

    expect(screen.getByTestId('controls-migration')).toBeTruthy();
    rerender(<RecommendedControlsPrompt gameplayActive />);
    expect(screen.queryByTestId('controls-migration')).toBeNull();
  });
});

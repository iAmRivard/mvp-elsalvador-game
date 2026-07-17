// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VehicleGarageDialog } from '../src/components/garage/VehicleGarageDialog';
import { useGameStore } from '../src/store/gameStore';

describe('garaje móvil', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
    useGameStore.setState({
      unlockedVehicleIds: ['torogoz', 'volcan-gt'],
    });
  });

  afterEach(cleanup);

  it('muestra tres vehículos, estadísticas y bloquea selección indebida', () => {
    render(<VehicleGarageDialog open onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Garaje' })).toBeTruthy();
    expect(screen.getAllByText('Torogoz')).toHaveLength(2);
    expect(screen.getByText('Volcán GT')).toBeTruthy();
    expect(screen.getByText('Coyote 4x4')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Coyote 4x4 · Bloqueado' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByText('Velocidad')).toBeTruthy();
    expect(screen.getByText('Offroad')).toBeTruthy();
  });

  it('confirma vehículo y skin desbloqueados mediante la UI', () => {
    const onClose = vi.fn();
    render(<VehicleGarageDialog open onClose={onClose} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Seleccionar Volcán GT' }),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Obsidiana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vehículo' }));

    expect(useGameStore.getState()).toMatchObject({
      selectedVehicleId: 'volcan-gt',
      selectedVehicleSkinId: 'volcan-obsidian',
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cierra sin modificar la selección pendiente', () => {
    const onClose = vi.fn();
    render(<VehicleGarageDialog open onClose={onClose} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Seleccionar Volcán GT' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(useGameStore.getState().selectedVehicleId).toBe('torogoz');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

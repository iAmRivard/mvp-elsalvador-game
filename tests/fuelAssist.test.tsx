// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FuelAssist } from '../src/components/hud/FuelAssist';
import { fuelStationById } from '../src/data/fuelStations';
import { useGameStore } from '../src/store/gameStore';

const capitalStation = fuelStationById.get('abastecimiento-san-salvador')!;

describe('asistencia visible de combustible', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  afterEach(cleanup);

  it('muestra la estación más cercana al llegar a 25%', () => {
    useGameStore.setState((state) => ({
      telemetry: { ...state.telemetry, fuel: 25 },
      vehicle: { ...state.vehicle, fuel: 25 },
    }));
    render(<FuelAssist />);

    expect(screen.getByText('Combustible bajo')).toBeTruthy();
    expect(screen.getByText(/Estación más cercana:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar ruta' }));
    expect(useGameStore.getState().navigationTarget).toMatchObject({
      kind: 'fuel-station',
      id: capitalStation.id,
    });
  });

  it('ofrece autonomía y consume un bidón al llegar a 10%', () => {
    useGameStore.setState((state) => ({
      telemetry: { ...state.telemetry, fuel: 10 },
      vehicle: { ...state.vehicle, fuel: 10 },
      inventory: [{ itemId: 'bidon-combustible', quantity: 1 }],
    }));
    render(<FuelAssist />);

    expect(screen.getByText('Combustible crítico')).toBeTruthy();
    expect(screen.getByText(/Autonomía aproximada:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Usar bidón (1)' }));
    expect(useGameStore.getState().telemetry.fuel).toBe(40);
    expect(useGameStore.getState().inventory).toEqual([]);
  });

  it('explica la recarga al detenerse dentro del punto', () => {
    useGameStore.setState((state) => ({
      activeMissionId: 'la-transmision',
      telemetry: {
        ...state.telemetry,
        longitude: capitalStation.coordinates[0],
        latitude: capitalStation.coordinates[1],
        speedMetersPerSecond: 0,
        speedKilometersPerHour: 0,
        fuel: 18,
      },
      vehicle: { ...state.vehicle, fuel: 18 },
      navigationTarget: {
        kind: 'fuel-station',
        id: capitalStation.id,
        label: capitalStation.name,
        coordinates: capitalStation.coordinates,
      },
    }));
    render(<FuelAssist />);

    expect(screen.getByText('Punto de combustible')).toBeTruthy();
    expect(screen.getByText('Combustible actual: 18%')).toBeTruthy();
    expect(screen.getByText('Costo: gratuito')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }));

    expect(useGameStore.getState()).toMatchObject({
      activeMissionId: 'la-transmision',
      navigationTarget: null,
      telemetry: { fuel: 63 },
      lastSafeCheckpoint: { reason: 'fuel-station' },
    });
  });
});

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

  it('no muestra CTA con combustible alto aunque esté en una estación', () => {
    useGameStore.setState((state) => ({
      telemetry: {
        ...state.telemetry,
        longitude: capitalStation.coordinates[0],
        latitude: capitalStation.coordinates[1],
        fuel: 75,
      },
      vehicle: { ...state.vehicle, fuel: 75 },
    }));
    const { container } = render(<FuelAssist />);

    expect(container.firstChild).toBeNull();
  });

  it('muestra una estación discreta entre 25% y 35%', () => {
    useGameStore.setState((state) => ({
      telemetry: { ...state.telemetry, fuel: 30 },
      vehicle: { ...state.vehicle, fuel: 30 },
    }));
    render(<FuelAssist />);

    expect(screen.getByText('Estación cercana')).toBeTruthy();
    expect(screen.getByText(/· \d+(\.\d+)? (m|km)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Estación cercana/i }));
    expect(useGameStore.getState().navigationTarget).toMatchObject({
      kind: 'fuel-station',
      id: capitalStation.id,
    });
  });

  it('muestra CTA prominente bajo 25% y permite usar un bidón', () => {
    useGameStore.setState((state) => ({
      telemetry: { ...state.telemetry, fuel: 19 },
      vehicle: { ...state.vehicle, fuel: 19 },
      inventory: [{ itemId: 'bidon-combustible', quantity: 1 }],
    }));
    render(<FuelAssist />);

    expect(screen.getByText('Combustible bajo')).toBeTruthy();
    expect(screen.getByText(/Estación más cercana:/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Marcar ruta' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Usar bidón (1)' }));
    expect(useGameStore.getState().telemetry.fuel).toBe(49);
    expect(useGameStore.getState().inventory).toEqual([]);
  });

  it('muestra distancia y regreso a misión con ruta temporal activa', () => {
    useGameStore.setState((state) => ({
      activeMissionId: 'la-transmision',
      telemetry: { ...state.telemetry, fuel: 75 },
      vehicle: { ...state.vehicle, fuel: 75 },
      navigationTarget: {
        kind: 'fuel-station',
        id: capitalStation.id,
        label: capitalStation.name,
        coordinates: capitalStation.coordinates,
      },
    }));
    render(<FuelAssist />);

    expect(screen.getByText(/Punto de combustible ·/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a misión' }));
    expect(useGameStore.getState().navigationTarget).toBeNull();
  });

  it('prioriza la estación seleccionada aunque haya otra más cercana', () => {
    const selectedStation = fuelStationById.get('abastecimiento-las-delicias')!;
    useGameStore.setState((state) => ({
      telemetry: {
        ...state.telemetry,
        longitude: capitalStation.coordinates[0],
        latitude: capitalStation.coordinates[1],
        fuel: 30,
      },
      vehicle: { ...state.vehicle, fuel: 30 },
      navigationTarget: {
        kind: 'fuel-station',
        id: selectedStation.id,
        label: selectedStation.name,
        coordinates: selectedStation.coordinates,
      },
    }));
    render(<FuelAssist />);

    expect(screen.getByText(selectedStation.name)).toBeTruthy();
    expect(screen.queryByText('Recargar combustible')).toBeNull();
  });

  it('muestra recarga compacta en estación con combustible bajo no crítico', () => {
    useGameStore.setState((state) => ({
      telemetry: {
        ...state.telemetry,
        longitude: capitalStation.coordinates[0],
        latitude: capitalStation.coordinates[1],
        speedMetersPerSecond: 0,
        speedKilometersPerHour: 0,
        fuel: 30,
      },
      vehicle: { ...state.vehicle, fuel: 30 },
    }));
    render(<FuelAssist />);

    expect(screen.getByText('Recargar combustible')).toBeTruthy();
    expect(screen.queryByText('Punto de combustible')).toBeNull();
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Recargar combustible' }),
    );

    expect(useGameStore.getState()).toMatchObject({
      activeMissionId: 'la-transmision',
      navigationTarget: null,
      telemetry: { fuel: 63 },
      lastSafeCheckpoint: { reason: 'fuel-station' },
    });
  });

  it('mantiene 25% en la banda discreta, no en la alerta prominente', () => {
    useGameStore.setState((state) => ({
      telemetry: { ...state.telemetry, fuel: 25 },
      vehicle: { ...state.vehicle, fuel: 25 },
    }));
    render(<FuelAssist />);

    expect(screen.getByText('Estación cercana')).toBeTruthy();
    expect(screen.queryByText('Combustible bajo')).toBeNull();
  });
});

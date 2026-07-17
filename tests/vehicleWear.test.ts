import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vehicleStateConfig } from '../src/config/vehicleState.config';
import { conditionWarningForTransition } from '../src/game/conditionWarnings';
import { useGameStore } from '../src/store/gameStore';

describe('balance de desgaste del vehículo', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  const applyReadyWear = (
    distanceMeters: number,
    surface: 'offroad' | 'track' | 'dirt-road' | 'primary',
    impact = false,
  ) => {
    useGameStore.getState().setRoadNetworkStatus('ready');
    useGameStore.getState().applyDrivingWear(distanceMeters, surface, impact);
  };

  it('mantiene daño razonable tras 30 segundos y 2 minutos offroad', () => {
    const offroadBoostSpeed = 38 * 0.25;
    applyReadyWear(offroadBoostSpeed * 30, 'offroad');
    expect(useGameStore.getState().vehicle.condition).toBeCloseTo(92.875, 3);

    useGameStore.setState(useGameStore.getInitialState(), true);
    applyReadyWear(offroadBoostSpeed * 120, 'offroad');
    expect(useGameStore.getState().vehicle.condition).toBeCloseTo(71.5, 3);
    expect(useGameStore.getState().recoveryReason).toBeNull();
  });

  it('no desgasta en carretera y diferencia los caminos track', () => {
    applyReadyWear(26 * 60 * 10, 'primary');
    expect(useGameStore.getState().vehicle.condition).toBe(100);

    applyReadyWear(10.4 * 120, 'track');
    expect(useGameStore.getState().vehicle.condition).toBeCloseTo(90.016, 3);

    useGameStore.setState(useGameStore.getInitialState(), true);
    applyReadyWear(10.4 * 120, 'dirt-road');
    expect(useGameStore.getState().vehicle.condition).toBeCloseTo(87.52, 3);
  });

  it('aplica impactos controlados y no daño cuando la red carga o falla', () => {
    useGameStore.getState().applyDrivingWear(2_000, 'offroad', true);
    expect(useGameStore.getState().vehicle.condition).toBe(100);

    useGameStore.getState().setRoadNetworkStatus('unavailable');
    useGameStore.getState().applyDrivingWear(2_000, 'offroad', true);
    expect(useGameStore.getState().vehicle.condition).toBe(100);

    applyReadyWear(0, 'primary', true);
    expect(useGameStore.getState().vehicle.condition).toBe(
      100 - vehicleStateConfig.blockedImpactCondition,
    );
  });

  it('emite cada umbral una sola vez y activa recuperación al llegar a cero', () => {
    expect(conditionWarningForTransition(30, 24)).toBe('damaged');
    expect(conditionWarningForTransition(24, 20)).toBeNull();
    expect(conditionWarningForTransition(14, 9)).toBe('critical');
    expect(conditionWarningForTransition(2, 0)).toBe('broken');

    applyReadyWear(4_100, 'offroad');
    expect(useGameStore.getState()).toMatchObject({
      vehicle: { condition: 0 },
      conditionWarning: 'broken',
      conditionWarningsShown: ['broken'],
      recoveryReason: 'condition',
      isPaused: true,
    });
  });

  it('agrupa una ventana de muestras en una sola escritura equivalente', () => {
    useGameStore.getState().setRoadNetworkStatus('ready');
    const listener = vi.fn();
    const unsubscribe = useGameStore.subscribe(listener);
    listener.mockClear();

    useGameStore.getState().applyDrivingWearSamples([
      {
        vehicleDistanceMeters: 10,
        surface: 'offroad',
        blockedImpact: false,
      },
      {
        vehicleDistanceMeters: 5,
        surface: 'track',
        blockedImpact: true,
      },
      {
        vehicleDistanceMeters: 20,
        surface: 'primary',
        blockedImpact: false,
      },
    ]);

    expect(listener).toHaveBeenCalledOnce();
    expect(useGameStore.getState().vehicle.condition).toBeCloseTo(
      100 -
        (10 * vehicleStateConfig.offroadConditionPerVehicleMeter +
          5 * vehicleStateConfig.trackConditionPerVehicleMeter +
          vehicleStateConfig.blockedImpactCondition),
      6,
    );
    unsubscribe();
  });
});

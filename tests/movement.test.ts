import { describe, expect, it } from 'vitest';
import {
  fuelConsumptionConfig,
  travelConfig,
} from '../src/config/travel.config';
import {
  EL_SALVADOR_MOVEMENT_BOUNDS,
  movePlayer,
  normalizeHeading,
  stepPlayer,
  stepPlayerDetailed,
} from '../src/game/movement';
import type { PlayerInput, PlayerRuntime } from '../src/types/game';

const player: PlayerRuntime = {
  longitude: -89.2182,
  latitude: 13.6929,
  heading: 0,
  speedMetersPerSecond: 0,
  fuel: 100,
  totalDistanceMeters: 0,
};

const idleInput: PlayerInput = {
  throttle: 0,
  turn: 0,
  boost: false,
  interact: false,
};

const travelAtScale = (geographicTravelScale: number) => ({
  ...travelConfig,
  geographicTravelScale,
});

describe('movimiento geografico del jugador', () => {
  it('normaliza el rumbo al intervalo de 0 a 360 grados', () => {
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(370)).toBe(10);
  });

  it('separa la distancia del vehiculo de la escala geografica', () => {
    const input = {
      longitude: player.longitude,
      latitude: player.latitude,
      heading: 0,
      speedMetersPerSecond: 10,
      deltaTimeSeconds: 1,
    };
    const scaleOne = movePlayer({ ...input, geographicTravelScale: 1 });
    const scaleFive = movePlayer({ ...input, geographicTravelScale: 5 });

    expect(scaleOne.vehicleDistanceMeters).toBe(10);
    expect(scaleOne.geographicDistanceMeters).toBe(10);
    expect(scaleFive.vehicleDistanceMeters).toBe(10);
    expect(scaleFive.geographicDistanceMeters).toBe(50);
    expect(scaleFive.latitude - player.latitude).toBeCloseTo(
      (scaleOne.latitude - player.latitude) * 5,
      8,
    );
  });

  it('no consume combustible ni distancia cuando esta detenido', () => {
    expect(stepPlayer(player, idleInput, 0.016)).toEqual(player);
  });

  it('no multiplica el consumo de combustible con la escala geografica', () => {
    const movingPlayer = { ...player, speedMetersPerSecond: 20 };
    const input = { ...idleInput, throttle: 1 as const };
    const scaleOne = stepPlayer(movingPlayer, input, 0.05, {
      travel: travelAtScale(1),
    });
    const scaleFive = stepPlayer(movingPlayer, input, 0.05, {
      travel: travelAtScale(5),
    });
    const vehicleDistance = scaleOne.speedMetersPerSecond * 0.05;

    expect(scaleOne.fuel).toBeCloseTo(
      100 - vehicleDistance * fuelConsumptionConfig.percentPerVehicleMeter,
      10,
    );
    expect(scaleFive.fuel).toBeCloseTo(scaleOne.fuel, 12);
    expect(scaleFive.totalDistanceMeters).toBeCloseTo(
      scaleOne.totalDistanceMeters * 5,
      8,
    );
  });

  it('permite superar la velocidad normal solamente con turbo', () => {
    const cruisingPlayer = {
      ...player,
      speedMetersPerSecond: travelConfig.normalMaximumSpeedMetersPerSecond,
    };
    const normal = stepPlayer(
      cruisingPlayer,
      { ...idleInput, throttle: 1 },
      0.05,
    );
    const boosted = stepPlayer(
      cruisingPlayer,
      { ...idleInput, throttle: 1, boost: true },
      0.05,
    );

    expect(normal.speedMetersPerSecond).toBe(
      travelConfig.normalMaximumSpeedMetersPerSecond,
    );
    expect(boosted.speedMetersPerSecond).toBeGreaterThan(
      normal.speedMetersPerSecond,
    );
    expect(boosted.speedMetersPerSecond).toBeLessThanOrEqual(
      travelConfig.boostMaximumSpeedMetersPerSecond,
    );
    expect(boosted.fuel).toBeLessThan(normal.fuel);
  });

  it('frena con mas fuerza que la aceleracion normal', () => {
    const movingPlayer = { ...player, speedMetersPerSecond: 20 };
    const accelerated = stepPlayer(
      movingPlayer,
      { ...idleInput, throttle: 1 },
      0.05,
    );
    const braking = stepPlayer(
      movingPlayer,
      { ...idleInput, throttle: -1 },
      0.05,
    );

    expect(accelerated.speedMetersPerSecond - 20).toBeCloseTo(0.45, 8);
    expect(20 - braking.speedMetersPerSecond).toBeCloseTo(0.7, 8);
  });

  it('se desplaza y gira en sentido inverso al retroceder', () => {
    const reversing = stepPlayer(
      { ...player, speedMetersPerSecond: -4 },
      { ...idleInput, throttle: -1, turn: 1 },
      0.05,
    );

    expect(reversing.speedMetersPerSecond).toBeLessThan(-4);
    expect(reversing.latitude).toBeLessThan(player.latitude);
    expect(reversing.heading).toBeGreaterThan(350);
  });

  it('reduce el giro a alta velocidad y respeta la sensibilidad', () => {
    const turnInput = { ...idleInput, turn: 1 as const };
    const lowSpeed = stepPlayer(
      { ...player, speedMetersPerSecond: 5 },
      turnInput,
      0.05,
    );
    const highSpeed = stepPlayer(
      {
        ...player,
        speedMetersPerSecond: travelConfig.boostMaximumSpeedMetersPerSecond,
      },
      turnInput,
      0.05,
    );
    const soft = stepPlayer(
      { ...player, speedMetersPerSecond: 15 },
      turnInput,
      0.05,
      { steeringSensitivity: 'low' },
    );
    const direct = stepPlayer(
      { ...player, speedMetersPerSecond: 15 },
      turnInput,
      0.05,
      { steeringSensitivity: 'high' },
    );

    expect(highSpeed.heading).toBeLessThan(lowSpeed.heading);
    expect(direct.heading).toBeGreaterThan(soft.heading);
  });

  it('limita deltas grandes antes de procesar los subpasos', () => {
    const movingPlayer = { ...player, speedMetersPerSecond: 10 };
    const maximumDelta = stepPlayer(movingPlayer, idleInput, 0.25);
    const largeDelta = stepPlayer(movingPlayer, idleInput, 5);

    expect(largeDelta).toEqual(maximumDelta);
  });

  it('divide el desplazamiento geografico en pasos de hasta diez metros', () => {
    const result = stepPlayerDetailed(
      { ...player, speedMetersPerSecond: 38 },
      idleInput,
      0.25,
    );

    expect(result.substeps).toBe(5);
    expect(
      result.samples.every((sample) => sample.geographicDistanceMeters <= 10),
    ).toBe(true);
  });

  it('respeta el limite de subpasos aun con escalas extremas', () => {
    const result = stepPlayerDetailed(
      { ...player, speedMetersPerSecond: 20 },
      idleInput,
      0.25,
      {
        travel: travelAtScale(1_000),
        movementSubsteps: {
          maximumGeographicStepMeters: 1,
          maximumSubstepsPerFrame: 12,
          maximumDeltaTimeSeconds: 0.25,
        },
      },
    );

    expect(result.substeps).toBe(12);
  });

  it('detecta agua intermedia aunque el punto final quedaria al otro lado', () => {
    const waterStartLatitude = player.latitude + 0.0015;
    const waterEndLatitude = player.latitude + 0.0022;
    const result = stepPlayerDetailed(
      { ...player, speedMetersPerSecond: 20 },
      idleInput,
      0.25,
      {
        travel: travelAtScale(100),
        restrictedAreaTypeAt: ([, latitude]) =>
          latitude >= waterStartLatitude && latitude <= waterEndLatitude
            ? 'water'
            : null,
      },
    );

    expect(result.environment.movementBlockedBy).toBe('water');
    expect(result.player.latitude).toBeLessThan(waterStartLatitude);
    expect(result.player.speedMetersPerSecond).toBe(0);
    expect(result.substeps).toBeLessThan(12);
  });

  it('expone posiciones intermedias para objetivos cruzados entre frames', () => {
    const objectiveLatitude = player.latitude + 0.002;
    const result = stepPlayerDetailed(
      { ...player, speedMetersPerSecond: 20 },
      idleInput,
      0.25,
      { travel: travelAtScale(100) },
    );

    expect(result.player.latitude).toBeGreaterThan(objectiveLatitude + 0.001);
    expect(
      result.samples.some(
        (sample) =>
          Math.abs(sample.player.latitude - objectiveLatitude) < 0.0004,
      ),
    ).toBe(true);
  });

  it('detiene el vehiculo al alcanzar los limites geograficos', () => {
    const boundaryPlayer = {
      ...player,
      latitude: EL_SALVADOR_MOVEMENT_BOUNDS.north - 0.000001,
      speedMetersPerSecond: travelConfig.boostMaximumSpeedMetersPerSecond,
      fuel: 40,
      totalDistanceMeters: 500,
    };
    const next = stepPlayer(
      boundaryPlayer,
      { ...idleInput, throttle: 1, boost: true },
      0.05,
    );

    expect(next.latitude).toBe(EL_SALVADOR_MOVEMENT_BOUNDS.north);
    expect(next.speedMetersPerSecond).toBe(0);
    expect(next.fuel).toBe(boundaryPlayer.fuel);
    expect(next.totalDistanceMeters).toBe(boundaryPlayer.totalDistanceMeters);
  });

  it('frena el vehículo cuando su condición impide conducir', () => {
    const next = stepPlayer(
      { ...player, speedMetersPerSecond: 12 },
      { ...idleInput, throttle: 1 },
      0.05,
      { driveEnabled: false },
    );

    expect(next.speedMetersPerSecond).toBeLessThan(12);
    expect(next.speedMetersPerSecond).toBeCloseTo(11.3, 8);
  });
});

/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { fuelConsumptionConfig } from '../src/config/travel.config';
import { vehicleStateConfig } from '../src/config/vehicleState.config';
import { missionById } from '../src/data/missions';
import { vehicleRuntimeFor } from '../src/data/vehicles';
import {
  estimateFuelAtDestination,
  estimateFuelRange,
  fuelConsumedForGeographicDistance,
  fuelSufficiency,
} from '../src/game/fuel';
import { parseRoadNetwork } from '../src/roads/roadNetwork';
import { AStarRouter } from '../src/roads/routingService';
import { RoadSpatialIndex } from '../src/roads/spatialIndex';

async function router() {
  const serialized = await readFile(
    'public/data/roads/western-corridor.json',
    'utf8',
  );
  const network = parseRoadNetwork(JSON.parse(serialized) as unknown);
  return new AStarRouter(network, new RoadSpatialIndex(network));
}

describe('balance de combustible v0.2.3', () => {
  it('mantiene los hitos del capítulo dentro de los rangos de playtest', async () => {
    const localRouter = await router();
    const first = localRouter.getRoute({
      origin: [-89.1908911, 13.6962937],
      destination: [-89.3175451, 13.6820687],
    })!;
    const second = localRouter.getRoute({
      origin: [-89.3175451, 13.6820687],
      destination: [-89.3592277, 13.7305749],
    })!;
    const choice = missionById
      .get('camino-hacia-santa-ana')!
      .objectives.find((objective) => objective.type === 'choice')!.choice!;
    const north = choice.options.find((option) => option.id === 'north')!;
    const south = choice.options.find((option) => option.id === 'south')!;
    const northRoute = localRouter.getRoute({
      origin: [-89.3592277, 13.7305749],
      destination: [-89.447361, 13.8408999],
      temporarilyClosedEdgeIds: north.closedRoadEdgeIds,
    })!;
    const southRoute = localRouter.getRoute({
      origin: [-89.3592277, 13.7305749],
      destination: [-89.447361, 13.8408999],
      temporarilyClosedEdgeIds: south.closedRoadEdgeIds,
    })!;

    const afterTransmission = estimateFuelAtDestination(
      first.distanceMeters,
      75,
      { fuelMultiplier: 1 },
    );
    const atBlockage = estimateFuelAtDestination(
      second.distanceMeters,
      afterTransmission,
      { fuelMultiplier: 1 },
    );
    const northAtStation = estimateFuelAtDestination(
      northRoute.distanceMeters,
      atBlockage,
      { fuelMultiplier: north.fuelMultiplier ?? 1 },
    );
    const southAtStation = estimateFuelAtDestination(
      southRoute.distanceMeters,
      atBlockage,
      { fuelMultiplier: south.fuelMultiplier ?? 1 },
    );

    expect(afterTransmission).toBeGreaterThanOrEqual(55);
    expect(afterTransmission).toBeLessThanOrEqual(70);
    expect(atBlockage).toBeGreaterThanOrEqual(35);
    expect(atBlockage).toBeLessThanOrEqual(55);
    expect(northAtStation).toBeGreaterThanOrEqual(15);
    expect(northAtStation).toBeLessThanOrEqual(30);
    expect(southAtStation).toBeGreaterThanOrEqual(15);
    expect(southAtStation).toBeLessThanOrEqual(30);
    const northAfterCan = Math.min(100, northAtStation + 45);
    const southAfterCan = Math.min(100, southAtStation + 45);
    expect(northAfterCan).toBeGreaterThanOrEqual(60);
    expect(northAfterCan).toBeLessThanOrEqual(80);
    expect(southAfterCan).toBeGreaterThanOrEqual(60);
    expect(southAfterCan).toBeLessThanOrEqual(80);
    expect(northRoute.distanceMeters).toBeGreaterThan(
      southRoute.distanceMeters,
    );
  });

  it('turbo y fuera de carretera aumentan el consumo de forma determinista', () => {
    const normal = fuelConsumedForGeographicDistance(20_000, {
      fuelMultiplier: 1,
    });
    const turbo = fuelConsumedForGeographicDistance(20_000, {
      fuelMultiplier: 1,
      boostShare: 0.2,
    });
    const offroad = fuelConsumedForGeographicDistance(20_000, {
      fuelMultiplier: 1,
      offroadShare: 1,
    });
    expect(turbo).toBeGreaterThan(normal);
    expect(offroad).toBeGreaterThan(turbo);
    expect(fuelConsumptionConfig.percentPerGeographicMeter).toBe(0.0009);
  });

  it('anticipa combustible insuficiente y conserva recuperación limitada', () => {
    expect(estimateFuelRange(42, 'primary')).toBeGreaterThan(35_000);
    expect(
      fuelSufficiency(
        estimateFuelAtDestination(20_000, 10, { fuelMultiplier: 1 }),
      ),
    ).toBe('insufficient');
    expect(vehicleStateConfig.emergencyRecoveryFuel).toBeGreaterThan(0);
    expect(vehicleStateConfig.emergencyRecoveryFuel).toBeLessThanOrEqual(20);
  });
  it('aplica la eficiencia del vehiculo a estimaciones y autonomia', () => {
    const torogoz = vehicleRuntimeFor('torogoz').fuel;
    const volcan = vehicleRuntimeFor('volcan-gt').fuel;
    const coyote = vehicleRuntimeFor('coyote-4x4').fuel;

    const torogozConsumption = fuelConsumedForGeographicDistance(
      20_000,
      { fuelMultiplier: 1 },
      torogoz,
    );
    const volcanConsumption = fuelConsumedForGeographicDistance(
      20_000,
      { fuelMultiplier: 1 },
      volcan,
    );
    const coyoteConsumption = fuelConsumedForGeographicDistance(
      20_000,
      { fuelMultiplier: 1 },
      coyote,
    );

    expect(volcanConsumption).toBeGreaterThan(coyoteConsumption);
    expect(coyoteConsumption).toBeGreaterThan(torogozConsumption);
    expect(estimateFuelRange(42, 'primary', volcan)).toBeLessThan(
      estimateFuelRange(42, 'primary', torogoz),
    );
    expect(
      estimateFuelRange(
        42,
        'offroad',
        coyote,
        vehicleRuntimeFor('coyote-4x4').handling.offroadFuelMultiplier,
      ),
    ).toBeGreaterThan(
      estimateFuelRange(
        42,
        'offroad',
        volcan,
        vehicleRuntimeFor('volcan-gt').handling.offroadFuelMultiplier,
      ),
    );
    expect(
      estimateFuelAtDestination(20_000, 42, { fuelMultiplier: 1 }, torogoz),
    ).toBeGreaterThan(
      estimateFuelAtDestination(20_000, 42, { fuelMultiplier: 1 }, volcan),
    );
  });
});

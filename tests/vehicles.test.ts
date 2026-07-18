import { describe, expect, it } from 'vitest';
import {
  initialVehicleId,
  vehicleById,
  vehicleDefinitions,
  vehicleRuntimeById,
  unlockedVehicleIdsFor,
  validVehicleDefinition,
  validVehicleSkinId,
} from '../src/data/vehicles';

describe('catálogo de vehículos arcade', () => {
  it('define exactamente tres arquetipos válidos con assets locales', () => {
    expect(vehicleDefinitions.map((vehicle) => vehicle.id)).toEqual([
      'torogoz',
      'volcan-gt',
      'coyote-4x4',
    ]);
    expect(new Set(vehicleDefinitions.map((vehicle) => vehicle.id)).size).toBe(
      3,
    );

    for (const vehicle of vehicleDefinitions) {
      expect(validVehicleDefinition(vehicle)).toBe(true);
      expect(vehicle.modelUrl).toMatch(/^\/models\/[a-z0-9-]+\.glb$/);
      expect(vehicle.modelUrl).not.toMatch(/^https?:/);
      expect(vehicle.skins.length).toBeGreaterThanOrEqual(2);
      expect(validVehicleSkinId(vehicle.id, vehicle.defaultSkinId)).toBe(true);
      expect(vehicleById.get(vehicle.id)).toBe(vehicle);
    }
  });

  it('mantiene Torogoz como fallback y desbloquea progreso retroactivo', () => {
    expect(initialVehicleId).toBe('torogoz');
    expect(unlockedVehicleIdsFor([])).toEqual(['torogoz']);
    expect(unlockedVehicleIdsFor(['la-transmision'])).toEqual([
      'torogoz',
      'volcan-gt',
    ]);
    expect(
      unlockedVehicleIdsFor(['la-transmision', 'senales-en-suchitoto']),
    ).toEqual(['torogoz', 'volcan-gt', 'coyote-4x4']);
  });

  it('deriva perfiles reales sin compartir objetos mutables', () => {
    const torogoz = vehicleRuntimeById.get('torogoz');
    const volcan = vehicleRuntimeById.get('volcan-gt');
    const coyote = vehicleRuntimeById.get('coyote-4x4');

    expect(torogoz).toBeDefined();
    expect(volcan).toBeDefined();
    expect(coyote).toBeDefined();
    expect(volcan!.handling.maximumForwardSpeed).toBeGreaterThan(
      torogoz!.handling.maximumForwardSpeed,
    );
    expect(volcan!.handling.acceleration).toBeGreaterThan(
      torogoz!.handling.acceleration,
    );
    expect(coyote!.handling.offroadSpeedMultiplier).toBeGreaterThan(
      torogoz!.handling.offroadSpeedMultiplier,
    );
    expect(coyote!.conditionWearMultiplier).toBeLessThan(
      torogoz!.conditionWearMultiplier,
    );
    expect(volcan!.fuel.percentPerGeographicMeter).toBeGreaterThan(
      torogoz!.fuel.percentPerGeographicMeter,
    );
  });
});

import {
  fuelConsumptionConfig,
  travelConfig,
  vehicleHandlingConfig,
} from '../config/travel.config';
import { modelConfig } from '../config/model.config';
import type {
  VehicleDefinition,
  VehicleId,
  VehicleRuntimeProfile,
  VehicleSkinDefinition,
} from '../types/vehicles';

export const initialVehicleId: VehicleId = 'torogoz';

export const vehicleDefinitions: readonly VehicleDefinition[] = [
  {
    id: 'torogoz',
    name: 'Torogoz',
    description: 'Balanceado, resistente y fácil de controlar.',
    modelUrl: modelConfig.playerVehicleUrl,
    modelScale: 1,
    maximumSpeed: 26,
    boostSpeed: 38,
    acceleration: 9,
    braking: 14,
    steering: 90,
    offroadGrip: 1,
    fuelEfficiency: 1,
    durability: 1,
    audioProfileId: 'expedition-balanced',
    defaultSkinId: 'torogoz-cyan',
    skins: [
      {
        id: 'torogoz-cyan',
        name: 'Cielo',
        bodyColor: 0x11d9f2,
        bodyColorCss: '#11d9f2',
        accentColorCss: '#e8fbff',
      },
      {
        id: 'torogoz-ochre',
        name: 'Copinol',
        bodyColor: 0xd99a3d,
        bodyColorCss: '#d99a3d',
        accentColorCss: '#fff0c8',
      },
    ],
    initiallyUnlocked: true,
    unlockMissionId: null,
    unlockDescription: 'Vehículo inicial',
  },
  {
    id: 'volcan-gt',
    name: 'Volcán GT',
    description: 'Acelera con fuerza y alcanza mayor velocidad en carretera.',
    modelUrl: modelConfig.playerVehicleUrl,
    modelScale: 1,
    maximumSpeed: 29,
    boostSpeed: 41,
    acceleration: 11.2,
    braking: 13,
    steering: 96,
    offroadGrip: 0.85,
    fuelEfficiency: 0.82,
    durability: 0.82,
    audioProfileId: 'expedition-sport',
    defaultSkinId: 'volcan-crimson',
    skins: [
      {
        id: 'volcan-crimson',
        name: 'Magma',
        bodyColor: 0xe04a3f,
        bodyColorCss: '#e04a3f',
        accentColorCss: '#ffe1a8',
      },
      {
        id: 'volcan-obsidian',
        name: 'Obsidiana',
        bodyColor: 0x34313c,
        bodyColorCss: '#34313c',
        accentColorCss: '#ff7d52',
      },
    ],
    initiallyUnlocked: false,
    unlockMissionId: 'la-transmision',
    unlockDescription: 'Completa La transmisión',
  },
  {
    id: 'coyote-4x4',
    name: 'Coyote 4x4',
    description: 'Estable, durable y con mejor agarre fuera de carretera.',
    modelUrl: modelConfig.playerVehicleUrl,
    modelScale: 1,
    maximumSpeed: 23.5,
    boostSpeed: 34,
    acceleration: 8.5,
    braking: 15,
    steering: 82,
    offroadGrip: 1.2,
    fuelEfficiency: 0.9,
    durability: 1.25,
    audioProfileId: 'expedition-offroad',
    defaultSkinId: 'coyote-forest',
    skins: [
      {
        id: 'coyote-forest',
        name: 'Bosque',
        bodyColor: 0x39785f,
        bodyColorCss: '#39785f',
        accentColorCss: '#daf3bb',
      },
      {
        id: 'coyote-sand',
        name: 'Arena',
        bodyColor: 0xb98a52,
        bodyColorCss: '#b98a52',
        accentColorCss: '#fff0c7',
      },
    ],
    initiallyUnlocked: false,
    unlockMissionId: 'senales-en-suchitoto',
    unlockDescription: 'Completa el desafío de Suchitoto',
  },
] as const;

export const vehicleById = new Map(
  vehicleDefinitions.map((vehicle) => [vehicle.id, vehicle]),
);

const vehicleIdSet = new Set<VehicleId>(
  vehicleDefinitions.map((vehicle) => vehicle.id),
);

export function isVehicleId(value: unknown): value is VehicleId {
  return typeof value === 'string' && vehicleIdSet.has(value as VehicleId);
}

export function vehicleDefinitionFor(value: unknown): VehicleDefinition {
  return isVehicleId(value)
    ? (vehicleById.get(value) ?? vehicleById.get(initialVehicleId)!)
    : vehicleById.get(initialVehicleId)!;
}

export function vehicleSkinFor(
  vehicleId: unknown,
  skinId: unknown,
): VehicleSkinDefinition {
  const vehicle = vehicleDefinitionFor(vehicleId);
  return (
    vehicle.skins.find((skin) => skin.id === skinId) ??
    vehicle.skins.find((skin) => skin.id === vehicle.defaultSkinId) ??
    vehicle.skins[0]
  );
}

export function validVehicleSkinId(
  vehicleId: unknown,
  skinId: unknown,
): boolean {
  return (
    typeof skinId === 'string' &&
    vehicleDefinitionFor(vehicleId).skins.some((skin) => skin.id === skinId)
  );
}

export function validVehicleDefinition(definition: VehicleDefinition): boolean {
  const values = [
    definition.modelScale,
    definition.maximumSpeed,
    definition.boostSpeed,
    definition.acceleration,
    definition.braking,
    definition.steering,
    definition.offroadGrip,
    definition.fuelEfficiency,
    definition.durability,
  ];
  return (
    isVehicleId(definition.id) &&
    definition.name.length > 0 &&
    definition.modelUrl.startsWith('/models/') &&
    !definition.modelUrl.startsWith('//') &&
    definition.modelUrl.endsWith('.glb') &&
    values.every((value) => Number.isFinite(value) && value > 0) &&
    definition.boostSpeed >= definition.maximumSpeed &&
    definition.skins.length > 0 &&
    new Set(definition.skins.map((skin) => skin.id)).size ===
      definition.skins.length &&
    validVehicleSkinId(definition.id, definition.defaultSkinId)
  );
}

export function unlockedVehicleIdsFor(
  completedMissionIds: readonly string[],
  requestedIds: readonly unknown[] = [],
): VehicleId[] {
  const completed = new Set(completedMissionIds);
  const requested = new Set(requestedIds.filter(isVehicleId));
  return vehicleDefinitions.flatMap((vehicle) =>
    vehicle.initiallyUnlocked ||
    requested.has(vehicle.id) ||
    (vehicle.unlockMissionId !== null && completed.has(vehicle.unlockMissionId))
      ? [vehicle.id]
      : [],
  );
}

function runtimeProfileFor(vehicle: VehicleDefinition): VehicleRuntimeProfile {
  return {
    travel: {
      ...travelConfig,
      normalMaximumSpeedMetersPerSecond: vehicle.maximumSpeed,
      boostMaximumSpeedMetersPerSecond: vehicle.boostSpeed,
      accelerationMetersPerSecondSquared: vehicle.acceleration,
      brakingMetersPerSecondSquared: vehicle.braking,
    },
    handling: {
      ...vehicleHandlingConfig,
      maximumForwardSpeed: vehicle.maximumSpeed,
      maximumBoostSpeed: vehicle.boostSpeed,
      acceleration: vehicle.acceleration,
      braking: vehicle.braking,
      baseTurnRate: vehicle.steering,
      offroadSpeedMultiplier:
        vehicleHandlingConfig.offroadSpeedMultiplier * vehicle.offroadGrip,
      offroadFuelMultiplier:
        vehicleHandlingConfig.offroadFuelMultiplier / vehicle.offroadGrip,
    },
    fuel: {
      ...fuelConsumptionConfig,
      percentPerGeographicMeter:
        fuelConsumptionConfig.percentPerGeographicMeter /
        vehicle.fuelEfficiency,
    },
    conditionWearMultiplier: 1 / vehicle.durability,
  };
}

export const vehicleRuntimeById = new Map<VehicleId, VehicleRuntimeProfile>(
  vehicleDefinitions.map((vehicle) => [vehicle.id, runtimeProfileFor(vehicle)]),
);

export function vehicleRuntimeFor(value: unknown): VehicleRuntimeProfile {
  return (
    vehicleRuntimeById.get(vehicleDefinitionFor(value).id) ??
    vehicleRuntimeById.get(initialVehicleId)!
  );
}

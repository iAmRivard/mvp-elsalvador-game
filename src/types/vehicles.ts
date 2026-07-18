import type {
  FuelConsumptionConfig,
  TravelConfig,
  VehicleHandlingConfig,
} from '../config/travel.config';

export type VehicleId = 'torogoz' | 'volcan-gt' | 'coyote-4x4';

export type VehicleAudioProfileId =
  'expedition-balanced' | 'expedition-sport' | 'expedition-offroad';

export interface VehicleSkinDefinition {
  id: string;
  name: string;
  bodyColor: number;
  bodyColorCss: string;
  accentColorCss: string;
}

export interface VehicleDefinition {
  id: VehicleId;
  name: string;
  description: string;
  modelUrl: string;
  modelScale: number;
  maximumSpeed: number;
  boostSpeed: number;
  acceleration: number;
  braking: number;
  steering: number;
  offroadGrip: number;
  fuelEfficiency: number;
  durability: number;
  audioProfileId: VehicleAudioProfileId;
  defaultSkinId: string;
  skins: readonly VehicleSkinDefinition[];
  initiallyUnlocked: boolean;
  unlockMissionId: string | null;
  unlockDescription: string;
}

export interface VehicleRuntimeProfile {
  travel: TravelConfig;
  handling: VehicleHandlingConfig;
  fuel: FuelConsumptionConfig;
  conditionWearMultiplier: number;
}

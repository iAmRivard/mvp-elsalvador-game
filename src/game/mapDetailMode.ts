import type { DrivingPresentationMode } from './drivingPresentation';

export type MapDetailMode = 'exploration' | 'arcade-driving' | 'arcade-fast';

export interface MapDetailModeInput {
  isFollowingPlayer: boolean;
  presentationMode: DrivingPresentationMode;
  activeMissionId: string | null;
  isMapSelectionMode?: boolean;
}

export function deriveMapDetailMode(input: MapDetailModeInput): MapDetailMode {
  if (!input.isFollowingPlayer || input.isMapSelectionMode) {
    return 'exploration';
  }
  if (input.presentationMode === 'fast') return 'arcade-fast';

  // Una misión activa conserva el detalle arcade aunque el vehículo se
  // detenga. Fuera de misión, seguir al jugador también es conducción, no una
  // exploración deliberada del mapa.
  void input.activeMissionId;
  return 'arcade-driving';
}

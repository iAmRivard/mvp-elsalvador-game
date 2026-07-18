import type { VehicleSkinDefinition } from '../types/vehicles';

export function applyPlayerMarkerSkin(
  marker: HTMLElement,
  skin: Pick<VehicleSkinDefinition, 'bodyColorCss' | 'accentColorCss'>,
): void {
  marker.style.setProperty('--player-vehicle-body', skin.bodyColorCss);
  marker.style.setProperty('--player-vehicle-accent', skin.accentColorCss);
}

export function createPlayerMarkerElement(
  skin?: Pick<VehicleSkinDefinition, 'bodyColorCss' | 'accentColorCss'>,
): HTMLDivElement {
  const marker = document.createElement('div');
  marker.className = 'player-marker';
  marker.setAttribute('role', 'img');
  marker.setAttribute('aria-label', 'Vehículo del jugador');
  if (skin) applyPlayerMarkerSkin(marker, skin);

  const pulse = document.createElement('span');
  pulse.className = 'player-marker__pulse';
  pulse.setAttribute('aria-hidden', 'true');

  const vehicle = document.createElement('span');
  vehicle.className = 'player-marker__vehicle';
  vehicle.setAttribute('aria-hidden', 'true');

  marker.append(pulse, vehicle);
  return marker;
}

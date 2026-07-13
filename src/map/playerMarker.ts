export function createPlayerMarkerElement(): HTMLDivElement {
  const marker = document.createElement('div');
  marker.className = 'player-marker';
  marker.setAttribute('role', 'img');
  marker.setAttribute('aria-label', 'Vehículo del jugador');

  const pulse = document.createElement('span');
  pulse.className = 'player-marker__pulse';
  pulse.setAttribute('aria-hidden', 'true');

  const vehicle = document.createElement('span');
  vehicle.className = 'player-marker__vehicle';
  vehicle.setAttribute('aria-hidden', 'true');

  marker.append(pulse, vehicle);
  return marker;
}

export interface NavigationGuidanceScreenPoint {
  x: number;
  y: number;
}

export const navigationGuidanceMinimumCenterDistancePixels = 62;

export function navigationGuidanceOffsetForPlayerSeparation(
  player: NavigationGuidanceScreenPoint,
  guidance: NavigationGuidanceScreenPoint,
  minimumCenterDistancePixels = navigationGuidanceMinimumCenterDistancePixels,
): [number, number] {
  const deltaX = guidance.x - player.x;
  const deltaY = guidance.y - player.y;
  const currentDistance = Math.hypot(deltaX, deltaY);
  if (
    !Number.isFinite(currentDistance) ||
    !Number.isFinite(minimumCenterDistancePixels) ||
    minimumCenterDistancePixels <= 0 ||
    currentDistance >= minimumCenterDistancePixels
  ) {
    return [0, 0];
  }
  if (currentDistance <= Number.EPSILON) {
    return [0, -minimumCenterDistancePixels];
  }
  const additionalDistance = minimumCenterDistancePixels - currentDistance;
  return [
    (deltaX / currentDistance) * additionalDistance,
    (deltaY / currentDistance) * additionalDistance,
  ];
}

export function createNavigationGuidanceElement(): HTMLDivElement {
  const marker = document.createElement('div');
  marker.className = 'mission-route-arrow navigation-guidance-arrow';
  marker.setAttribute('role', 'img');
  marker.setAttribute('aria-label', 'Chevrons de dirección de la ruta');
  for (let index = 0; index < 3; index += 1) {
    const chevron = document.createElement('span');
    chevron.className = 'navigation-guidance-arrow__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '›';
    marker.append(chevron);
  }
  marker.hidden = true;
  return marker;
}

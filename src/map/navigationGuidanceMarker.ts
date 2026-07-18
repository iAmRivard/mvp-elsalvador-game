export interface NavigationGuidanceScreenPoint {
  x: number;
  y: number;
}

export const navigationGuidanceMinimumCenterDistancePixels = 62;
// The marker is 14x20px and rotates with the map. Its half diagonal is
// 12.2px; 20px also keeps the small drop shadow inside the canvas.
export const navigationGuidanceViewportMarginPixels = 20;

export function navigationGuidanceFitsViewport(
  guidance: NavigationGuidanceScreenPoint,
  offset: readonly [number, number],
  viewportWidth: number,
  viewportHeight: number,
  marginPixels = navigationGuidanceViewportMarginPixels,
): boolean {
  const adjustedX = guidance.x + offset[0];
  const adjustedY = guidance.y + offset[1];
  if (
    !Number.isFinite(adjustedX) ||
    !Number.isFinite(adjustedY) ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    !Number.isFinite(marginPixels) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return false;
  }
  const margin = Math.max(0, marginPixels);
  return (
    adjustedX >= margin &&
    adjustedX <= viewportWidth - margin &&
    adjustedY >= margin &&
    adjustedY <= viewportHeight - margin
  );
}

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
  marker.className =
    'mission-route-arrow navigation-guidance-arrow navigation-guidance-arrow--hidden';
  marker.setAttribute('role', 'img');
  marker.setAttribute('aria-hidden', 'true');
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

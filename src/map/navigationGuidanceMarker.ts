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

import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import { fuelStationConfig } from '../config/fuelStations.config';
import { fuelStations, type FuelStationDefinition } from '../data/fuelStations';
import { distanceBetweenMeters } from '../game/discovery';
import { isFuelStationAvailable } from '../game/fuelStations';
import { useGameStore } from '../store/gameStore';

interface FuelStationMarkerEntry {
  station: FuelStationDefinition;
  element: HTMLButtonElement;
  marker: maplibregl.Marker;
}

function formatDistance(distanceMeters: number): string {
  return distanceMeters < 1_000
    ? `${Math.round(distanceMeters)} m`
    : `${(distanceMeters / 1_000).toFixed(1)} km`;
}

function popupContent(station: FuelStationDefinition): HTMLElement {
  const gameState = useGameStore.getState();
  const available = isFuelStationAvailable(station, gameState.currentChapterId);
  const distance = distanceBetweenMeters(
    [gameState.telemetry.longitude, gameState.telemetry.latitude],
    station.coordinates,
  );
  const content = document.createElement('article');
  content.className = 'fuel-station-popup';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'fuel-station-popup__eyebrow';
  eyebrow.textContent = 'Punto narrativo de abastecimiento';

  const title = document.createElement('h3');
  title.textContent = station.name;

  const description = document.createElement('p');
  description.textContent =
    'Reserva local de la expedición. La recarga es gratuita al detenerte dentro del punto.';

  const status = document.createElement('span');
  status.className = 'fuel-station-popup__state';
  status.textContent = `${available ? 'Disponible' : 'No disponible'} · ${formatDistance(distance)} · +${String(station.refuelAmount)}%`;

  const routeButton = document.createElement('button');
  routeButton.type = 'button';
  routeButton.className = 'map-route-button';
  routeButton.disabled = !available;
  routeButton.textContent = available ? 'Marcar ruta' : 'No disponible';
  routeButton.addEventListener('click', () => {
    if (useGameStore.getState().markFuelStationRoute(station.id)) {
      routeButton.textContent = 'Ruta marcada';
    }
  });

  content.append(eyebrow, title, description, status, routeButton);
  return content;
}

function updateEntry(entry: FuelStationMarkerEntry): void {
  const state = useGameStore.getState();
  const available = isFuelStationAvailable(
    entry.station,
    state.currentChapterId,
  );
  const isTarget =
    state.navigationTarget?.kind === 'fuel-station' &&
    state.navigationTarget.id === entry.station.id;
  entry.element.disabled = !available;
  entry.element.classList.toggle(
    'fuel-station-marker--unavailable',
    !available,
  );
  entry.element.classList.toggle('fuel-station-marker--target', isTarget);
  entry.element.setAttribute(
    'aria-label',
    `${entry.station.name}, ${available ? 'disponible' : 'no disponible'}`,
  );
}

export function addFuelStationMarkers(map: MapLibreMap): () => void {
  const popup = new maplibregl.Popup({
    closeButton: true,
    closeOnMove: true,
    focusAfterOpen: true,
    maxWidth: '290px',
    offset: 24,
  });
  const entries = fuelStations.map<FuelStationMarkerEntry>((station) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'fuel-station-marker';
    element.style.setProperty(
      '--fuel-station-color',
      fuelStationConfig.markerColor,
    );
    const symbol = document.createElement('span');
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = '⛽';
    element.append(symbol);

    const marker = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat(station.coordinates)
      .addTo(map);
    const entry = { station, element, marker };
    updateEntry(entry);
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      popup
        .setLngLat(station.coordinates)
        .setDOMContent(popupContent(station))
        .addTo(map);
    });
    return entry;
  });

  const unsubscribe = useGameStore.subscribe((state, previousState) => {
    if (
      state.currentChapterId !== previousState.currentChapterId ||
      state.navigationTarget !== previousState.navigationTarget
    ) {
      entries.forEach(updateEntry);
    }
  });

  return () => {
    unsubscribe();
    popup.remove();
    entries.forEach((entry) => entry.marker.remove());
  };
}

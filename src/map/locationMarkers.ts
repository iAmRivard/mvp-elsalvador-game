import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import {
  locations,
  type GameLocation,
  type GameLocationType,
} from '../data/locations';
import { missionById } from '../data/missions';
import { useGameStore } from '../store/gameStore';

const locationSymbols: Readonly<Record<GameLocationType, string>> = {
  city: '◆',
  town: '◇',
  volcano: '▲',
  lake: '≈',
  beach: '∿',
  forest: '♣',
  ruin: '✦',
  station: '●',
};

interface LocationMarkerEntry {
  location: GameLocation;
  element: HTMLButtonElement;
  label: HTMLSpanElement;
  status: HTMLSpanElement;
  marker: maplibregl.Marker;
}

function popupContent(
  location: GameLocation,
  unlocked: boolean,
  discovered: boolean,
): HTMLElement {
  const content = document.createElement('article');
  content.className = 'location-popup';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'location-popup__eyebrow';
  eyebrow.textContent = unlocked ? location.department : 'Señal bloqueada';

  const title = document.createElement('h3');
  title.textContent = unlocked ? location.name : 'Ubicación desconocida';

  const description = document.createElement('p');
  description.textContent = unlocked
    ? location.description
    : 'Esta señal necesita un desbloqueo de historia antes de poder investigarse.';

  const state = document.createElement('span');
  state.className = 'location-popup__state';
  state.textContent = discovered
    ? '✓ Ubicación descubierta'
    : unlocked
      ? 'Acércate para descubrirla'
      : 'Bloqueada';

  content.append(eyebrow, title, description, state);
  return content;
}

function updateEntry(entry: LocationMarkerEntry): void {
  const state = useGameStore.getState();
  const unlocked = state.unlockedLocationIds.includes(entry.location.id);
  const discovered = state.discoveredLocationIds.includes(entry.location.id);
  const activeMission = state.activeMissionId
    ? missionById.get(state.activeMissionId)
    : null;
  const isMissionDestination =
    activeMission?.destinationLocationId === entry.location.id;

  entry.element.classList.toggle('location-marker--locked', !unlocked);
  entry.element.classList.toggle('location-marker--discovered', discovered);
  entry.element.classList.toggle(
    'location-marker--mission',
    isMissionDestination,
  );
  entry.element.setAttribute(
    'aria-label',
    unlocked
      ? `${entry.location.name}, ${discovered ? 'descubierta' : 'sin descubrir'}`
      : 'Señal de ubicación bloqueada',
  );
  entry.label.textContent = unlocked
    ? entry.location.name
    : 'Señal desconocida';
  entry.status.textContent = unlocked
    ? locationSymbols[entry.location.type]
    : '×';
}

export function addLocationMarkers(map: MapLibreMap): () => void {
  const popup = new maplibregl.Popup({
    closeButton: true,
    closeOnMove: true,
    focusAfterOpen: true,
    maxWidth: '290px',
    offset: 24,
  });

  const entries: LocationMarkerEntry[] = locations.map((location) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `location-marker location-marker--${location.type}`;

    const status = document.createElement('span');
    status.className = 'location-marker__symbol';
    status.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'location-marker__label';
    label.setAttribute('aria-hidden', 'true');
    element.append(status, label);

    const marker = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat(location.coordinates)
      .addTo(map);
    const entry = { location, element, label, status, marker };
    updateEntry(entry);

    element.addEventListener('click', (event) => {
      event.stopPropagation();
      const state = useGameStore.getState();
      popup
        .setLngLat(location.coordinates)
        .setDOMContent(
          popupContent(
            location,
            state.unlockedLocationIds.includes(location.id),
            state.discoveredLocationIds.includes(location.id),
          ),
        )
        .addTo(map);
    });

    return entry;
  });

  const unsubscribe = useGameStore.subscribe((state, previousState) => {
    if (
      state.discoveredLocationIds !== previousState.discoveredLocationIds ||
      state.unlockedLocationIds !== previousState.unlockedLocationIds ||
      state.activeMissionId !== previousState.activeMissionId
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

import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import {
  locations,
  type GameLocation,
  type GameLocationType,
} from '../data/locations';
import { missionById } from '../data/missions';
import { distanceBetweenMeters } from '../game/discovery';
import { useGameStore } from '../store/gameStore';
import { layoutLocationMarkers } from './locationMarkerLayout';

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

const locationTypeLabels: Readonly<Record<GameLocationType, string>> = {
  city: 'Ciudad',
  town: 'Pueblo',
  volcano: 'Volcán',
  lake: 'Lago',
  beach: 'Playa',
  forest: 'Bosque',
  ruin: 'Ruina',
  station: 'Estación',
};

interface LocationMarkerEntry {
  location: GameLocation;
  element: HTMLButtonElement;
  label: HTMLSpanElement;
  labelTitle: HTMLSpanElement;
  labelDetail: HTMLElement;
  status: HTMLSpanElement;
  marker: maplibregl.Marker;
}

function formatDistance(distanceMeters: number): string {
  return distanceMeters < 1_000
    ? `${Math.round(distanceMeters)} m`
    : `${(distanceMeters / 1_000).toFixed(1)} km`;
}

function popupContent(
  location: GameLocation,
  unlocked: boolean,
  discovered: boolean,
): HTMLElement {
  const gameState = useGameStore.getState();
  const content = document.createElement('article');
  content.className = 'location-popup';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'location-popup__eyebrow';
  eyebrow.textContent = unlocked
    ? `${locationTypeLabels[location.type]} · ${location.department}`
    : 'Señal bloqueada';

  const title = document.createElement('h3');
  title.textContent = unlocked ? location.name : 'Ubicación desconocida';

  const description = document.createElement('p');
  description.textContent = unlocked
    ? location.description
    : 'Esta señal necesita un desbloqueo de historia antes de poder investigarse.';

  const state = document.createElement('span');
  state.className = 'location-popup__state';
  const distance = formatDistance(
    distanceBetweenMeters(
      [gameState.telemetry.longitude, gameState.telemetry.latitude],
      location.coordinates,
    ),
  );
  state.textContent = discovered
    ? `✓ Descubierta · ${distance}`
    : unlocked
      ? `Sin descubrir · ${distance}`
      : `Bloqueada · ${distance}`;

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
  entry.labelTitle.textContent = unlocked
    ? entry.location.name
    : 'Señal desconocida';
  entry.labelDetail.textContent = unlocked
    ? `${locationTypeLabels[entry.location.type]} · ${
        discovered ? 'Descubierta' : 'Sin descubrir'
      }`
    : 'Bloqueada';
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
  let selectedLocationId: string | null = null;

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
    const labelTitle = document.createElement('span');
    labelTitle.className = 'location-marker__label-title';
    const labelDetail = document.createElement('small');
    labelDetail.className = 'location-marker__label-detail';
    label.append(labelTitle, labelDetail);
    element.append(status, label);

    const marker = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat(location.coordinates)
      .addTo(map);
    const entry = {
      location,
      element,
      label,
      labelTitle,
      labelDetail,
      status,
      marker,
    };
    updateEntry(entry);
    return entry;
  });

  const updateLayout = () => {
    const state = useGameStore.getState();
    const activeMission = state.activeMissionId
      ? missionById.get(state.activeMissionId)
      : null;
    const container = map.getContainer();
    const layout = layoutLocationMarkers(
      entries.map((entry) => ({
        id: entry.location.id,
        name: entry.location.name,
        type: entry.location.type,
        point: map.project(entry.location.coordinates),
        unlocked: state.unlockedLocationIds.includes(entry.location.id),
        discovered: state.discoveredLocationIds.includes(entry.location.id),
        mission: activeMission?.destinationLocationId === entry.location.id,
        selected: selectedLocationId === entry.location.id,
      })),
      { width: container.clientWidth, height: container.clientHeight },
      map.getZoom(),
      map.getPitch(),
    );
    let visibleLabelCount = 0;
    layout.forEach((result, index) => {
      const entry = entries[index];
      const visible = result.labelMode !== 'none';
      entry.label.hidden = !visible;
      entry.element.dataset.labelMode = result.labelMode;
      entry.labelTitle.textContent = visible
        ? result.label
        : entry.location.name;
      entry.labelDetail.hidden = result.labelMode !== 'full';
      entry.label.style.setProperty(
        '--location-label-x',
        `${result.labelOffset.x}px`,
      );
      entry.label.style.setProperty(
        '--location-label-y',
        `${result.labelOffset.y}px`,
      );
      if (visible) visibleLabelCount += 1;
    });
    container.dataset.locationLabelCount = String(visibleLabelCount);
    container.dataset.locationLabelMode =
      layout.find((result) => result.labelMode !== 'none')?.labelMode ?? 'none';
  };

  entries.forEach((entry) => {
    entry.element.addEventListener('click', (event) => {
      event.stopPropagation();
      selectedLocationId = entry.location.id;
      const state = useGameStore.getState();
      popup
        .setLngLat(entry.location.coordinates)
        .setDOMContent(
          popupContent(
            entry.location,
            state.unlockedLocationIds.includes(entry.location.id),
            state.discoveredLocationIds.includes(entry.location.id),
          ),
        )
        .addTo(map);
      updateLayout();
    });
  });
  popup.on('close', () => {
    selectedLocationId = null;
    updateLayout();
  });

  const unsubscribe = useGameStore.subscribe((state, previousState) => {
    if (
      state.discoveredLocationIds !== previousState.discoveredLocationIds ||
      state.unlockedLocationIds !== previousState.unlockedLocationIds ||
      state.activeMissionId !== previousState.activeMissionId
    ) {
      entries.forEach(updateEntry);
      updateLayout();
    }
  });
  map.on('move', updateLayout);
  map.on('resize', updateLayout);
  updateLayout();

  return () => {
    unsubscribe();
    map.off('move', updateLayout);
    map.off('resize', updateLayout);
    popup.remove();
    entries.forEach((entry) => entry.marker.remove());
  };
}

import type { GameLocationType } from '../data/locations';

export type LocationLabelMode = 'none' | 'short' | 'full';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface LocationMarkerLayoutInput {
  id: string;
  name: string;
  type: GameLocationType;
  point: ScreenPoint;
  unlocked: boolean;
  discovered: boolean;
  mission: boolean;
  selected: boolean;
}

export interface MarkerViewport {
  width: number;
  height: number;
  padding?: number;
}

export interface LocationMarkerLayoutResult {
  id: string;
  labelMode: LocationLabelMode;
  label: string;
  labelOffset: ScreenPoint;
  priority: number;
}

interface LabelRectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const typePriority: Readonly<Record<GameLocationType, number>> = {
  city: 90,
  station: 85,
  town: 75,
  volcano: 65,
  lake: 60,
  ruin: 55,
  forest: 50,
  beach: 45,
};

export function shortLocationName(name: string): string {
  return name
    .replace(/^Estación abandonada de /, '')
    .replace(/^Repetidor de /, '')
    .replace(/^Volcán de /, '')
    .replace(/^Lago de /, '')
    .replace(/^Lago /, '');
}

export function locationLabelModeForZoom(zoom: number): LocationLabelMode {
  if (zoom < 8.75) return 'none';
  return zoom < 11.25 ? 'short' : 'full';
}

function markerPriority(marker: LocationMarkerLayoutInput): number {
  return (
    typePriority[marker.type] +
    (marker.unlocked ? 100 : -40) +
    (marker.discovered ? 80 : 0) +
    (marker.selected ? 800 : 0) +
    (marker.mission ? 1_000 : 0)
  );
}

function overlaps(a: LabelRectangle, b: LabelRectangle): boolean {
  return !(
    a.right + 4 <= b.left ||
    a.left >= b.right + 4 ||
    a.bottom + 4 <= b.top ||
    a.top >= b.bottom + 4
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function labelRectangle(
  marker: LocationMarkerLayoutInput,
  mode: Exclude<LocationLabelMode, 'none'>,
  viewport: Required<MarkerViewport>,
  pitch: number,
): { rectangle: LabelRectangle; offset: ScreenPoint } {
  const label = mode === 'short' ? shortLocationName(marker.name) : marker.name;
  const width = clamp(label.length * 6.4 + 20, 64, mode === 'full' ? 184 : 136);
  const height = mode === 'full' ? 43 : 27;
  const gap = 20 + clamp(pitch, 0, 70) * 0.11;
  const preferLeft = marker.point.x > viewport.width * 0.68;
  const preferAbove = marker.point.y > viewport.height * 0.68;
  const desiredLeft = preferLeft
    ? marker.point.x - width - gap
    : marker.point.x + gap;
  const desiredTop = preferAbove
    ? marker.point.y - height - gap
    : marker.point.y + gap;
  const left = clamp(
    desiredLeft,
    viewport.padding,
    Math.max(viewport.padding, viewport.width - viewport.padding - width),
  );
  const top = clamp(
    desiredTop,
    viewport.padding,
    Math.max(viewport.padding, viewport.height - viewport.padding - height),
  );
  return {
    rectangle: { left, top, right: left + width, bottom: top + height },
    offset: { x: left - marker.point.x, y: top - marker.point.y },
  };
}

export function layoutLocationMarkers(
  markers: readonly LocationMarkerLayoutInput[],
  viewportInput: MarkerViewport,
  zoom: number,
  pitch: number,
): LocationMarkerLayoutResult[] {
  const viewport: Required<MarkerViewport> = {
    ...viewportInput,
    padding: viewportInput.padding ?? 8,
  };
  const mode = locationLabelModeForZoom(zoom);
  const maximumLabels = mode === 'full' ? 10 : mode === 'short' ? 6 : 0;
  const visibleMarkers = markers
    .filter(
      ({ point }) =>
        point.x >= -16 &&
        point.y >= -16 &&
        point.x <= viewport.width + 16 &&
        point.y <= viewport.height + 16,
    )
    .sort((a, b) => markerPriority(b) - markerPriority(a));
  const accepted = new Map<
    string,
    { label: string; offset: ScreenPoint; priority: number }
  >();
  const occupied: LabelRectangle[] = [];

  if (mode !== 'none') {
    for (const marker of visibleMarkers) {
      if (accepted.size >= maximumLabels) break;
      const { rectangle, offset } = labelRectangle(
        marker,
        mode,
        viewport,
        pitch,
      );
      if (occupied.some((candidate) => overlaps(rectangle, candidate))) {
        continue;
      }
      occupied.push(rectangle);
      accepted.set(marker.id, {
        label: mode === 'short' ? shortLocationName(marker.name) : marker.name,
        offset,
        priority: markerPriority(marker),
      });
    }
  }

  return markers.map((marker) => {
    const label = accepted.get(marker.id);
    return {
      id: marker.id,
      labelMode: label ? mode : 'none',
      label: label?.label ?? '',
      labelOffset: label?.offset ?? { x: 0, y: 0 },
      priority: markerPriority(marker),
    };
  });
}

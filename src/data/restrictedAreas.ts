import type { Position } from 'geojson';
import { EL_SALVADOR_MOVEMENT_BOUNDS } from '../game/movement';
import type {
  RestrictedArea,
  RestrictedAreaType,
} from '../types/restrictedAreas';
import type { RoadCoordinates } from '../types/roads';

const lakeCoatepeque: RestrictedArea = {
  id: 'lake-coatepeque',
  type: 'water',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-89.565, 13.893],
        [-89.545, 13.895],
        [-89.529, 13.886],
        [-89.522, 13.867],
        [-89.529, 13.85],
        [-89.547, 13.84],
        [-89.562, 13.848],
        [-89.573, 13.864],
        [-89.571, 13.881],
        [-89.565, 13.893],
      ],
    ],
  },
};

const lakeIlopango: RestrictedArea = {
  id: 'lake-ilopango',
  type: 'water',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-89.0805, 13.696],
        [-89.054, 13.7105],
        [-89.026, 13.703],
        [-89.006, 13.6805],
        [-89.011, 13.654],
        [-89.035, 13.6385],
        [-89.062, 13.644],
        [-89.0815, 13.6655],
        [-89.0805, 13.696],
      ],
    ],
  },
};

const lakeGuija: RestrictedArea = {
  id: 'lake-guija',
  type: 'water',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-89.561, 14.264],
        [-89.531, 14.285],
        [-89.496, 14.279],
        [-89.473, 14.25],
        [-89.486, 14.216],
        [-89.525, 14.207],
        [-89.555, 14.229],
        [-89.561, 14.264],
      ],
    ],
  },
};

const pacificOcean: RestrictedArea = {
  id: 'pacific-ocean',
  type: 'water',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-90.2, 13],
        [-87.65, 13],
        [-87.65, 13.1],
        [-88.02, 13.12],
        [-88.4, 13.12],
        [-88.74, 13.2],
        [-89.04, 13.33],
        [-89.32, 13.43],
        [-89.64, 13.47],
        [-89.84, 13.52],
        [-90.17, 13.67],
        [-90.2, 13.67],
        [-90.2, 13],
      ],
    ],
  },
};

export const restrictedAreas: readonly RestrictedArea[] = [
  lakeCoatepeque,
  lakeIlopango,
  lakeGuija,
  pacificOcean,
];

const movementBoundsArea: RestrictedArea = {
  id: 'el-salvador-movement-bounds',
  type: 'out-of-bounds',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [EL_SALVADOR_MOVEMENT_BOUNDS.west, EL_SALVADOR_MOVEMENT_BOUNDS.south],
        [EL_SALVADOR_MOVEMENT_BOUNDS.east, EL_SALVADOR_MOVEMENT_BOUNDS.south],
        [EL_SALVADOR_MOVEMENT_BOUNDS.east, EL_SALVADOR_MOVEMENT_BOUNDS.north],
        [EL_SALVADOR_MOVEMENT_BOUNDS.west, EL_SALVADOR_MOVEMENT_BOUNDS.north],
        [EL_SALVADOR_MOVEMENT_BOUNDS.west, EL_SALVADOR_MOVEMENT_BOUNDS.south],
      ],
    ],
  },
};

function pointInRing(point: RoadCoordinates, ring: Position[]): boolean {
  let inside = false;
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current, current += 1
  ) {
    const currentPoint = ring[current];
    const previousPoint = ring[previous];
    const crossesLatitude =
      currentPoint[1] > point[1] !== previousPoint[1] > point[1];
    const longitudeAtLatitude =
      ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) /
        (previousPoint[1] - currentPoint[1]) +
      currentPoint[0];
    if (crossesLatitude && point[0] < longitudeAtLatitude) inside = !inside;
  }
  return inside;
}

function pointInPolygon(
  point: RoadCoordinates,
  coordinates: Position[][],
): boolean {
  if (!coordinates[0] || !pointInRing(point, coordinates[0])) return false;
  return !coordinates.slice(1).some((hole) => pointInRing(point, hole));
}

export function restrictedAreaAt(
  position: RoadCoordinates,
): RestrictedArea | null {
  const [longitude, latitude] = position;
  if (
    longitude < EL_SALVADOR_MOVEMENT_BOUNDS.west ||
    longitude > EL_SALVADOR_MOVEMENT_BOUNDS.east ||
    latitude < EL_SALVADOR_MOVEMENT_BOUNDS.south ||
    latitude > EL_SALVADOR_MOVEMENT_BOUNDS.north
  ) {
    return movementBoundsArea;
  }

  for (const area of restrictedAreas) {
    const polygons =
      area.geometry.type === 'Polygon'
        ? [area.geometry.coordinates]
        : area.geometry.coordinates;
    if (polygons.some((polygon) => pointInPolygon(position, polygon)))
      return area;
  }
  return null;
}

export function restrictedAreaTypeAt(
  position: RoadCoordinates,
): RestrictedAreaType | null {
  return restrictedAreaAt(position)?.type ?? null;
}

import type { MultiPolygon, Polygon } from 'geojson';

export type RestrictedAreaType = 'water' | 'blocked' | 'out-of-bounds';

export interface RestrictedArea {
  id: string;
  type: RestrictedAreaType;
  geometry: Polygon | MultiPolygon;
}

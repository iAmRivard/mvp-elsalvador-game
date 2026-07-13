export interface MapSourceConfig {
  archiveUrl: string;
  styleUrl: string;
  attribution: string;
  minZoom: number;
  maxZoom: number;
}

type Coordinates = [longitude: number, latitude: number];
type Bounds = [southwest: Coordinates, northeast: Coordinates];

function sameOriginPath(value: string | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

export const mapSourceConfig: MapSourceConfig = {
  archiveUrl: sameOriginPath(import.meta.env.VITE_MAP_ARCHIVE_URL, '/maps/el-salvador.pmtiles'),
  styleUrl: sameOriginPath(
    import.meta.env.VITE_MAP_STYLE_URL,
    '/map-assets/styles/el-salvador.json',
  ),
  attribution: '© OpenStreetMap contributors · Datos distribuidos bajo ODbL',
  minZoom: 7,
  maxZoom: 15,
};

export const mapViewConfig = {
  center: [-88.8965, 13.7942] as Coordinates,
  bounds: [
    [-90.25, 12.85],
    [-87.55, 14.65],
  ] as Bounds,
  zoom: 7.35,
  pitch: 48,
  bearing: -8,
} as const;

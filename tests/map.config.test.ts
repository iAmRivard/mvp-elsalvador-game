import { describe, expect, it } from 'vitest';
import { mapSourceConfig, mapViewConfig } from '../src/config/map.config';

describe('configuración cartográfica', () => {
  it('usa solamente recursos locales en tiempo de ejecución', () => {
    expect(mapSourceConfig.archiveUrl).toBe('/maps/el-salvador.pmtiles');
    expect(mapSourceConfig.styleUrl).toBe(
      '/map-assets/styles/el-salvador.json',
    );
    expect(mapSourceConfig.archiveUrl).not.toMatch(/^https?:/);
    expect(mapSourceConfig.styleUrl).not.toMatch(/^https?:/);
  });

  it('limita la cámara a la región de El Salvador', () => {
    const [[west, south], [east, north]] = mapViewConfig.bounds;
    const [longitude, latitude] = mapViewConfig.center;

    expect(longitude).toBeGreaterThan(west);
    expect(longitude).toBeLessThan(east);
    expect(latitude).toBeGreaterThan(south);
    expect(latitude).toBeLessThan(north);
    expect(mapSourceConfig.maxZoom).toBe(16);
  });
});

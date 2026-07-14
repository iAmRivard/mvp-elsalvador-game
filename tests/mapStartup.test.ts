import { describe, expect, it } from 'vitest';
import {
  isFatalMapError,
  mapErrorDetails,
  mapLoadingLabels,
} from '../src/map/mapStartup';

describe('arranque recuperable del mapa', () => {
  it('ignora fallos de recursos opcionales', () => {
    expect(
      isFatalMapError(
        new Error('AJAXError: /map-assets/sprites/basemap@2x.json (404)'),
      ),
    ).toBe(false);
    expect(isFatalMapError(new Error('/models/vehicle.glb (404)'))).toBe(false);
  });

  it('considera fatales el estilo y el PMTiles principal', () => {
    expect(isFatalMapError(new Error('/styles/el-salvador.json (404)'))).toBe(
      true,
    );
    expect(isFatalMapError(new Error('/maps/el-salvador.pmtiles (503)'))).toBe(
      true,
    );
  });

  it('mantiene los detalles separados del mensaje amigable', () => {
    expect(mapErrorDetails(new Error('AJAXError interno'))).toBe(
      'AJAXError interno',
    );
    expect(mapLoadingLabels.roads).toBe('Preparando carreteras…');
  });
});

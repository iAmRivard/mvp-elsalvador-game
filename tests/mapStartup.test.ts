import { describe, expect, it } from 'vitest';
import {
  classifyMapRuntimeError,
  mapErrorDetails,
  mapErrorResourceUrl,
  mapLoadingLabels,
  mapRuntimeErrorStopsGameplay,
} from '../src/map/mapStartup';

describe('arranque recuperable del mapa', () => {
  const primaryContext = {
    startupComplete: false,
    primaryStyleUrl: '/map-assets/styles/el-salvador.json',
    primaryArchiveUrl: '/maps/el-salvador.pmtiles',
    primarySourceId: 'el-salvador',
  } as const;

  it('clasifica sprites, modelos y audio como recursos opcionales', () => {
    expect(
      classifyMapRuntimeError(
        new Error('AJAXError: /map-assets/sprites/basemap@2x.json (404)'),
        primaryContext,
      ),
    ).toMatchObject({ severity: 'optional', resourceKind: 'decorative' });
    expect(
      classifyMapRuntimeError(new Error('/models/vehicle.glb (404)'), {
        ...primaryContext,
        resourceKind: 'model',
      }),
    ).toMatchObject({ severity: 'optional', resourceKind: 'model' });
    expect(
      classifyMapRuntimeError(new Error('/audio/engine.ogg (404)'), {
        ...primaryContext,
        resourceKind: 'audio',
      }),
    ).toMatchObject({ severity: 'optional', resourceKind: 'audio' });
  });

  it('considera fatales el estilo y el PMTiles principal', () => {
    const styleFailure = classifyMapRuntimeError(
      new Error('/map-assets/styles/el-salvador.json (404)'),
      primaryContext,
    );
    expect(styleFailure).toMatchObject({
      severity: 'fatal',
      reason: 'primary-style',
    });
    expect(mapRuntimeErrorStopsGameplay(styleFailure)).toBe(true);
    expect(
      classifyMapRuntimeError(
        new Error('/maps/el-salvador.pmtiles (503)'),
        {
          ...primaryContext,
          startupComplete: true,
        },
      ),
    ).toMatchObject({
      severity: 'fatal',
      reason: 'primary-map-source',
    });
  });

  it('mantiene fatal una fuente principal persistente y WebGL tras ready', () => {
    expect(
      classifyMapRuntimeError(new Error('fallo de fuente'), {
        ...primaryContext,
        startupComplete: true,
        sourceId: 'el-salvador',
        persistent: true,
      }),
    ).toMatchObject({ severity: 'fatal', resourceKind: 'primary-source' });
    expect(
      classifyMapRuntimeError(new Error('WebGL context lost'), {
        ...primaryContext,
        startupComplete: true,
      }),
    ).toMatchObject({ severity: 'fatal', resourceKind: 'webgl' });
  });

  it('degrada la red vial y las capas auxiliares sin ocultarlas', () => {
    const roadFailure = classifyMapRuntimeError(
      new Error('roads.geojson no disponible'),
      {
        ...primaryContext,
        resourceKind: 'road-network',
      },
    );
    expect(roadFailure).toMatchObject({
      severity: 'degraded',
      reason: 'road-network',
    });
    expect(mapRuntimeErrorStopsGameplay(roadFailure)).toBe(false);
    expect(
      classifyMapRuntimeError(new Error('falló una capa de diagnóstico'), {
        ...primaryContext,
        startupComplete: true,
        resourceKind: 'auxiliary-layer',
      }),
    ).toMatchObject({ severity: 'degraded', reason: 'auxiliary-layer' });
  });

  it('no ignora errores desconocidos', () => {
    expect(
      classifyMapRuntimeError(new Error('error desconocido'), primaryContext),
    ).toMatchObject({
      severity: 'fatal',
      reason: 'unknown-during-startup',
    });
    expect(
      classifyMapRuntimeError(new Error('error desconocido'), {
        ...primaryContext,
        startupComplete: true,
      }),
    ).toMatchObject({
      severity: 'degraded',
      reason: 'unknown-after-startup',
    });
  });

  it('prefiere la URL estructurada de errores HTTP', () => {
    const error = Object.assign(new Error('Service Unavailable'), {
      url: '/maps/el-salvador.pmtiles',
    });
    expect(mapErrorResourceUrl(error)).toBe('/maps/el-salvador.pmtiles');
    expect(
      classifyMapRuntimeError(error, {
        ...primaryContext,
        startupComplete: true,
      }),
    ).toMatchObject({ severity: 'fatal', reason: 'primary-map-source' });
  });

  it('mantiene los detalles separados del mensaje amigable', () => {
    expect(mapErrorDetails(new Error('AJAXError interno'))).toBe(
      'AJAXError interno',
    );
    expect(mapLoadingLabels.roads).toBe('Preparando carreteras…');
  });
});

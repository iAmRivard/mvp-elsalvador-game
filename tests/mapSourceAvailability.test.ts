import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapSourceConfig } from '../src/config/map.config';
import { probeMapSourceAvailability } from '../src/game/mapSourceAvailability';

afterEach(() => {
  vi.unstubAllGlobals();
});

function validArchiveResponse(): Response {
  return new Response(new Uint8Array(1_024), {
    status: 206,
    headers: { 'content-range': 'bytes 0-1023/67528221' },
  });
}

describe('disponibilidad de la fuente local del mapa', () => {
  it('sondea el estilo y el PMTiles configurados canónicamente', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(validArchiveResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(probeMapSourceAvailability()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      mapSourceConfig.styleUrl,
      expect.objectContaining({ method: 'HEAD', cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      mapSourceConfig.archiveUrl,
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Range: 'bytes=0-1023' },
      }),
    );
  });

  it('respeta un destino configurado no predeterminado', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(validArchiveResponse());
    vi.stubGlobal('fetch', fetchMock);
    const target = {
      styleUrl: '/map-assets/styles/alternate.json',
      archiveUrl: '/maps/alternate.pmtiles',
    };

    await expect(probeMapSourceAvailability(undefined, target)).resolves.toBe(
      true,
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      target.styleUrl,
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      target.archiveUrl,
      expect.any(Object),
    );
  });

  it.each([
    ['respuesta completa', 200, 'bytes 0-1023/67528221', 1_024],
    ['Content-Range inválido', 206, 'bytes 0-511/67528221', 1_024],
    ['cuerpo incompleto', 206, 'bytes 0-1023/67528221', 1_023],
  ])('rechaza PMTiles con %s', async (_label, status, contentRange, bytes) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(
          new Response(new Uint8Array(bytes), {
            status,
            headers: { 'content-range': contentRange },
          }),
        ),
    );

    await expect(probeMapSourceAvailability()).resolves.toBe(false);
  });

  it('rechaza un estilo ausente sin consultar el archivo pesado', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(probeMapSourceAvailability()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('degrada a no disponible ante un fallo de red', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );

    await expect(probeMapSourceAvailability()).resolves.toBe(false);
  });
});

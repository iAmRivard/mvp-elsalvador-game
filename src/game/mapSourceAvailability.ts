import { mapSourceConfig } from '../config/map.config';

const probeRange = 'bytes=0-1023';
const expectedContentRange = /^bytes 0-1023\/\d+$/i;

export interface MapSourceProbeTarget {
  styleUrl: string;
  archiveUrl: string;
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // El estado HTTP ya es suficiente; cancelar es solo una defensa de red.
  }
}

export async function probeMapSourceAvailability(
  signal?: AbortSignal,
  target: MapSourceProbeTarget = mapSourceConfig,
): Promise<boolean> {
  try {
    const styleResponse = await fetch(target.styleUrl, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin',
      signal,
    });
    if (!styleResponse.ok) {
      await cancelBody(styleResponse);
      return false;
    }

    const archiveResponse = await fetch(target.archiveUrl, {
      method: 'GET',
      headers: { Range: probeRange },
      cache: 'no-store',
      credentials: 'same-origin',
      signal,
    });
    if (
      archiveResponse.status !== 206 ||
      !expectedContentRange.test(
        archiveResponse.headers.get('content-range') ?? '',
      )
    ) {
      await cancelBody(archiveResponse);
      return false;
    }
    return (await archiveResponse.arrayBuffer()).byteLength === 1_024;
  } catch (error) {
    if (signal?.aborted) throw error;
    return false;
  }
}

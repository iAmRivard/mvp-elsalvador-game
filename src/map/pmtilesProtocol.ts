import maplibregl, { type AddProtocolAction } from 'maplibre-gl';
import { Protocol } from 'pmtiles';

const protocol = new Protocol();
let consumerCount = 0;
const failureListeners = new Set<(failure: PmtilesProtocolFailure) => void>();

export function registerPmtilesProtocol(): () => void {
  if (consumerCount === 0) {
    maplibregl.addProtocol('pmtiles', loadPmtilesResource);
  }
  consumerCount += 1;

  return () => {
    consumerCount = Math.max(0, consumerCount - 1);
    if (consumerCount === 0) {
      maplibregl.removeProtocol('pmtiles');
    }
  };
}

export interface PmtilesProtocolFailure {
  error: unknown;
  requestUrl: string;
}

const loadPmtilesResource: AddProtocolAction = async (
  requestParameters,
  abortController,
) => {
  try {
    return await protocol.tile(requestParameters, abortController);
  } catch (error) {
    if (!abortController.signal.aborted) {
      const failure = { error, requestUrl: requestParameters.url };
      for (const listener of failureListeners) listener(failure);
    }
    throw error;
  }
};

export function subscribePmtilesProtocolFailures(
  listener: (failure: PmtilesProtocolFailure) => void,
): () => void {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

const protocol = new Protocol();
let consumerCount = 0;

export function registerPmtilesProtocol(): () => void {
  if (consumerCount === 0) {
    maplibregl.addProtocol('pmtiles', protocol.tile);
  }
  consumerCount += 1;

  return () => {
    consumerCount = Math.max(0, consumerCount - 1);
    if (consumerCount === 0) {
      maplibregl.removeProtocol('pmtiles');
    }
  };
}

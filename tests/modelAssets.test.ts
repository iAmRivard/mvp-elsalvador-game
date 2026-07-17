/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { vehicleDefinitions } from '../src/data/vehicles';

const modelPaths = [
  'public/models/expedition-vehicle.glb',
  'public/models/suchitoto-signal.glb',
] as const;

describe('modelos 3D locales', () => {
  it.each(modelPaths)(
    '%s es un GLB v2 pequeño y autocontenido',
    async (path) => {
      const bytes = await readFile(path);
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('glTF');
      expect(bytes.readUInt32LE(4)).toBe(2);
      expect(bytes.readUInt32LE(8)).toBe(bytes.byteLength);
      expect(bytes.byteLength).toBeLessThan(100 * 1024);
    },
  );

  it('el modelo provisional compartido no contiene dependencias externas', async () => {
    const vehicleModelUrls = [
      ...new Set(vehicleDefinitions.map((vehicle) => vehicle.modelUrl)),
    ];
    expect(vehicleModelUrls).toEqual(['/models/expedition-vehicle.glb']);

    const bytes = await readFile(`public${vehicleModelUrls[0]}`);
    const jsonChunkLength = bytes.readUInt32LE(12);
    expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a);
    const manifest = JSON.parse(
      bytes
        .subarray(20, 20 + jsonChunkLength)
        .toString('utf8')
        .trim(),
    ) as {
      buffers?: { uri?: string }[];
      images?: unknown[];
      textures?: unknown[];
      materials?: { name?: string }[];
    };

    expect(manifest.buffers?.every((buffer) => buffer.uri === undefined)).toBe(
      true,
    );
    expect(manifest.images ?? []).toEqual([]);
    expect(manifest.textures ?? []).toEqual([]);
    expect(manifest.materials?.map((material) => material.name)).toContain(
      'carroceria-ocre',
    );
  });
});

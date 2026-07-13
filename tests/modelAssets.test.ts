/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

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
});

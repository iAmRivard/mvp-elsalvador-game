/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { audioCueUrls } from '../src/config/audio.config';

describe('audio local', () => {
  it('usa solamente rutas WAV del mismo origen', () => {
    for (const url of Object.values(audioCueUrls)) {
      expect(url).toMatch(/^\/audio\/[a-z-]+\.wav$/);
      expect(url).not.toContain('://');
    }
  });

  it.each(Object.values(audioCueUrls))(
    '%s es un WAV PCM pequeño',
    async (url) => {
      const bytes = await readFile(`public${url}`);
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString('ascii')).toBe('WAVE');
      expect(bytes.readUInt16LE(20)).toBe(1);
      expect(bytes.readUInt16LE(22)).toBe(1);
      expect(bytes.readUInt32LE(24)).toBe(22_050);
      expect(bytes.byteLength).toBeLessThan(80 * 1024);
    },
  );
});

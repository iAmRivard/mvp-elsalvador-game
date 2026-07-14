/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { adaptiveMusicGainMultiplier } from '../src/audio/gameAudio';
import { musicStateForGame } from '../src/audio/musicState';
import { audioConfig, musicTrackUrls } from '../src/config/audio.config';

describe('música adaptativa local', () => {
  it('selecciona exploración, misión, tiempo y silencio', () => {
    expect(musicStateForGame(null, false)).toBe('exploration');
    expect(musicStateForGame('la-transmision', false)).toBe('mission');
    expect(musicStateForGame('camino-hacia-santa-ana', true)).toBe('timed');
    expect(musicStateForGame('la-transmision', false, true)).toBe('silent');
  });

  it('reduce la música durante radio y pausa', () => {
    expect(adaptiveMusicGainMultiplier(false, false)).toBe(1);
    expect(adaptiveMusicGainMultiplier(true, false)).toBeLessThan(1);
    expect(adaptiveMusicGainMultiplier(false, true)).toBeLessThan(1);
    expect(adaptiveMusicGainMultiplier(true, true)).toBeLessThan(
      adaptiveMusicGainMultiplier(true, false),
    );
    expect(audioConfig.musicCrossfadeSeconds).toBeGreaterThanOrEqual(1);
    expect(audioConfig.musicCrossfadeSeconds).toBeLessThanOrEqual(2);
  });

  it.each(Object.values(musicTrackUrls))(
    '%s es un recurso WAV local y controlado',
    async (url) => {
      expect(url).toMatch(/^\/audio\/music-[a-z-]+\.wav$/);
      expect(url).not.toContain('://');
      const bytes = await readFile(`public${url}`);
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(bytes.readUInt32LE(24)).toBe(22_050);
      expect(bytes.byteLength).toBeLessThan(600 * 1024);
    },
  );
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  exitGameFullscreen,
  fullscreenActive,
  fullscreenSupported,
  requestGameFullscreen,
} from '../src/game/fullscreen';

describe('experiencia PWA', () => {
  it('declara manifest instalable, icono local y service worker local', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('public/manifest.webmanifest'), 'utf8'),
    ) as {
      name: string;
      display: string;
      start_url: string;
      icons: { src: string }[];
    };
    expect(manifest.name).toContain('Rutas Perdidas');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons.every((icon) => icon.src.startsWith('/'))).toBe(true);
    expect(
      readFileSync(resolve('public/images/app-icon-192.png')).length,
    ).toBeGreaterThan(1_000);
    expect(
      readFileSync(resolve('public/images/app-icon-512.png')).length,
    ).toBeGreaterThan(5_000);
    const serviceWorker = readFileSync(resolve('public/sw.js'), 'utf8');
    expect(serviceWorker).toContain("CACHE_VERSION = 'v0.2.5.3'");
    expect(serviceWorker).toContain("request.mode === 'navigate'");
    expect(serviceWorker).toContain('isHashedStaticAsset(url)');
    expect(serviceWorker).toContain("request.headers.has('range')");
    expect(serviceWorker).toContain("endsWith('.pmtiles')");
    expect(serviceWorker).toContain('event.waitUntil(');
    expect(readFileSync(resolve('index.html'), 'utf8')).toContain(
      '/manifest.webmanifest',
    );
  });

  it('tolera soporte estándar, prefijado y ausencia de fullscreen', async () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const exitFullscreen = vi.fn(() => Promise.resolve());
    const fakeDocument = {
      documentElement: { requestFullscreen },
      fullscreenElement: null,
      exitFullscreen,
    } as unknown as Document;

    expect(fullscreenSupported(fakeDocument)).toBe(true);
    expect(fullscreenActive(fakeDocument)).toBe(false);
    await expect(requestGameFullscreen(fakeDocument)).resolves.toBe(true);
    await expect(exitGameFullscreen(fakeDocument)).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(exitFullscreen).toHaveBeenCalledOnce();

    const unsupported = {
      documentElement: {},
      fullscreenElement: null,
    } as unknown as Document;
    expect(fullscreenSupported(unsupported)).toBe(false);
    await expect(requestGameFullscreen(unsupported)).resolves.toBe(false);
    await expect(exitGameFullscreen(unsupported)).resolves.toBe(false);
  });
});

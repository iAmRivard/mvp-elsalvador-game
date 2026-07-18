import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import {
  exitGameFullscreen,
  fullscreenActive,
  fullscreenSupported,
  requestGameFullscreen,
} from '../src/game/fullscreen';

describe('experiencia PWA', () => {
  it('sirve el manifest con un MIME instalable en Nginx', () => {
    const nginx = readFileSync(resolve('nginx/default.conf'), 'utf8');
    expect(nginx).toMatch(
      /location = \/manifest\.webmanifest \{[\s\S]*?default_type application\/manifest\+json;[\s\S]*?\}/,
    );
  });

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
    expect(serviceWorker).toContain("RELEASE_VERSION = 'v0.3.1'");
    expect(serviceWorker).toContain("BUILD_VERSION = '__BUILD_SHA__'");
    expect(serviceWorker).toContain("'/precache-manifest.json'");
    expect(serviceWorker).toContain('manifest.buildIdentity !== BUILD_VERSION');
    expect(serviceWorker).toContain("'/data/roads/western-corridor.json'");
    expect(serviceWorker).toContain("request.mode === 'navigate'");
    expect(serviceWorker).toContain('isHashedStaticAsset(url)');
    expect(serviceWorker).toContain("request.headers.has('range')");
    expect(serviceWorker).toContain("endsWith('.pmtiles')");
    expect(serviceWorker).toContain('event.waitUntil(');
    expect(readFileSync(resolve('index.html'), 'utf8')).toContain(
      '/manifest.webmanifest',
    );
  });

  it('aborta la instalacion antes de abrir caches si el SHA no coincide', async () => {
    const source = readFileSync(resolve('public/sw.js'), 'utf8').replaceAll(
      '__BUILD_SHA__',
      'expected-build',
    );
    const pending: Promise<unknown>[] = [];
    let installListener:
      | ((event: { waitUntil(promise: Promise<unknown>): void }) => void)
      | undefined;
    const openCache = vi.fn();

    runInNewContext(source, {
      URL,
      fetch: vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              buildIdentity: 'different-build',
              assets: ['/assets/index-fixture.js'],
            }),
        }),
      ),
      caches: {
        open: openCache,
        keys: vi.fn(),
        match: vi.fn(),
      },
      self: {
        addEventListener: (
          type: string,
          listener: (event: {
            waitUntil(promise: Promise<unknown>): void;
          }) => void,
        ) => {
          if (type === 'install') installListener = listener;
        },
      },
    });

    expect(installListener).toBeTypeOf('function');
    installListener?.({
      waitUntil: (promise) => pending.push(promise),
    });
    expect(pending).toHaveLength(1);
    await expect(pending[0]).rejects.toThrow(
      'La identidad del manifiesto no coincide con el build.',
    );
    expect(openCache).not.toHaveBeenCalled();
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

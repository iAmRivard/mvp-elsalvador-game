import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const packageMetadata = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

function buildSha(): string {
  const configured = process.env.VITE_BUILD_SHA?.trim();
  if (configured) return configured;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'local';
  }
}

function arcadePrecacheManifest(buildIdentity: string): Plugin {
  const safeBuildIdentity = buildIdentity.replace(/[^a-z0-9._-]/gi, '-');
  return {
    name: 'arcade-precache-manifest',
    generateBundle(_options, bundle) {
      const assets = Object.values(bundle)
        .map((entry) => entry.fileName)
        .filter(
          (fileName) =>
            fileName.startsWith('assets/') && !fileName.endsWith('.map'),
        )
        .map((fileName) => `/${fileName}`)
        .sort();
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: `${JSON.stringify({ buildIdentity, assets }, null, 2)}\n`,
      });
    },
    writeBundle(options) {
      if (!options.dir) return;
      const serviceWorkerPath = resolve(options.dir, 'sw.js');
      const source = readFileSync(serviceWorkerPath, 'utf8');
      if (!source.includes('__BUILD_SHA__')) {
        throw new Error('El service worker no contiene el token de build.');
      }
      writeFileSync(
        serviceWorkerPath,
        source.replaceAll('__BUILD_SHA__', safeBuildIdentity),
        'utf8',
      );
    },
  };
}

const currentBuildSha = buildSha();

export default defineConfig({
  plugins: [react(), arcadePrecacheManifest(currentBuildSha)],
  define: {
    __APP_VERSION__: JSON.stringify(packageMetadata.version),
    __BUILD_SHA__: JSON.stringify(currentBuildSha),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // MapLibre es un motor WebGL indivisible de ~1 MiB; se carga en un chunk diferido separado.
    chunkSizeWarningLimit: 1100,
  },
  server: {
    host: '0.0.0.0',
  },
});

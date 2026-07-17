import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageMetadata.version),
    __BUILD_SHA__: JSON.stringify(buildSha()),
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

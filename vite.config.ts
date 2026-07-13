import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
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

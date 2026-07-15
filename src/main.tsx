import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/noto-sans';
import 'maplibre-gl/dist/maplibre-gl.css';
import { App } from './app/App';
import './styles/global.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se encontró el contenedor principal de la aplicación.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

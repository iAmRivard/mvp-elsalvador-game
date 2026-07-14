# Rendimiento y diagnósticos

La red vial, el router y Three.js se cargan bajo demanda. El grafo y sus índices permanecen fuera de
Zustand; el game loop actualiza objetos imperativos por frame y entrega telemetría a React a 10 Hz.
Las rutas se almacenan en una caché LRU de 32 entradas y sólo se recalculan por objetivo, cierre,
desvío o solicitud del jugador.

## Métricas de desarrollo

`GameMap` publica atributos `data-*` para pruebas y diagnóstico. No forman parte del store ni del
guardado:

- `data-road-load-ms` y `data-road-file-bytes` para la carga del grafo;
- `data-road-search-ms` y `data-road-search-candidates` para la cuadrícula;
- `data-route-calculation-ms` para A*;
- `data-runtime-fps` como promedio aproximado de `requestAnimationFrame` por segundo;
- `data-memory-mb` cuando Chromium ofrece `performance.memory`.

## Medición local

Medición del build de producción del 13 de julio de 2026 con Chromium Playwright headless. Se usó
el inicio de **La transmisión**, el corredor cargado y una ruta vial activa.

| Medida                           |  1280x800 |  412x915 |
| -------------------------------- | --------: | -------: |
| Carga del JSON vial              | 1214.3 ms | 977.7 ms |
| Búsqueda vial promedio           |  0.172 ms | 0.108 ms |
| Candidatos de la última búsqueda |        26 |       26 |
| Cálculo A* de la primera ruta    |  26.50 ms | 19.60 ms |
| FPS aproximados, calidad baja    |      48.0 |     60.0 |
| Heap JS observado, calidad baja  |  17.4 MiB | 45.2 MiB |

El heap es una instantánea dependiente del recolector y no un límite estable. El modo alto con
Three.js llegó a `ready` en ambos viewports. La captura del canvas tuvo varianza de luminancia
`1727.67` y `2526.08`; después de conducir cambiaron 376,845 y 119,857 píxeles respectivamente, por
lo que el canvas no estaba vacío ni congelado.

Chromium headless usa render WebGL por software en esta máquina. En calidad alta reportó 8.9 FPS en
1280x800 y 21.6 FPS en 412x915; estas cifras sirven para comprobar degradación y fallback, no para
estimar una GPU de usuario. El perfil bajo desactiva Three.js, antialias y efectos; el perfil medio
baja automáticamente en equipos con hasta 4 GB o 4 procesadores lógicos.

## Tamaños

- Grafo vial: 5,795,394 bytes sin comprimir.
- Audio local completo: 384,112 bytes.
- Chunk inicial: 283.58 KiB, 85.13 KiB gzip.
- `GameMap`: 54.91 KiB, 19.60 KiB gzip.
- Capa Three.js: 608.77 KiB, 154.48 KiB gzip.
- Motor cartográfico diferido: 1,028.13 KiB, 273.19 KiB gzip.

Los valores pueden cambiar con el bundler. `npm run build`, `npm run test:e2e` y los atributos de
diagnóstico son la fuente para una medición nueva; no se fijan umbrales de FPS de hardware dentro
de CI.

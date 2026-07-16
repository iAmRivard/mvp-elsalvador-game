# Baseline móvil v0.2.5.2

Fecha: 16 de julio de 2026. Commit base:
`1a9eb830e7ee03e709aa6d28143073d135ecb508`.

## Protocolo

- Build de producción servido con Vite Preview en Windows.
- Chromium headless con emulación Pixel 7.
- Viewport interior medido: 412×839. Las capturas de control incluyen 392×850.
- Partida nueva, inicio de **La transmisión**, tutorial omitido y conducción con
  objetivo de velocidad de 59.7 km/h.
- 10 segundos de calentamiento y 30 segundos de observación.
- Captura con:
  `npm run capture:driving-ux -- http://127.0.0.1:4173 test-results/driving-ux-v0.2.5.2-baseline`.
- Duración total del capturador: 49.42 segundos.
- Mismo escenario y capturador que se usarán para la comparación optimizada.

La captura terminó en el estado visual **Vuelve a la ruta**. Este recorrido es
reproducible y se conservará sin cambios para la comparación, pero no representa
conducción ideal sobre el corredor durante los 30 segundos completos.

## Resultado

| Métrica | Baseline v0.2.5.2 |
| --- | ---: |
| FPS promedio | 51.93 |
| FPS mediano | 59.88 |
| Frametime promedio | 21.149 ms |
| Frametime p50 | 16.7 ms |
| Frametime p95 | 33.4 ms |
| Frametime p99 | 33.4 ms |
| Frames >33 ms | 382 |
| Frames >50 ms | 0 |
| Frames >100 ms | 0 |
| Long tasks | 0 |
| Cámara solicitada/s | n/d |
| Cámara aplicada/s | 17.67 |
| Cámara aplicada/s, ventana final expuesta | 18.4 |
| Cámara omitida por intervalo | n/d |
| Cámara omitida por tolerancia | n/d |
| Transiciones de cámara interrumpidas | 0 |
| Cámara promedio | 1.281 ms |
| Cámara p95 | 1.9 ms |
| RoadTracker promedio | 0.052 ms |
| RoadTracker p95 | 0.1 ms |
| Renders `MobileDrivingHud` | 151 |
| Actualizaciones Zustand totales | n/d |
| Ticks de telemetría observados | 282 |
| Actualizaciones GeoJSON | 115 |
| Consultas MapLibre diagnósticas | 0 |
| Heap final expuesto por Chromium | 45.20 MiB |
| Tiempo para seleccionar objetivo de 58 km/h | 1,112 ms |
| Latencia visual real de input | n/d |

La frecuencia de cámara aplicada se calculó con 530 muestras durante 30 segundos.
El valor expuesto por el juego corresponde a la última ventana móvil y por eso
no es idéntico al promedio completo.

La métrica vial actual cronometra la búsqueda espacial muestreada, no el
`RoadTracker.update` completo. Los ticks de telemetría tampoco equivalen a todas
las publicaciones de Zustand. Se mantienen como métricas parciales hasta
incorporar contadores explícitos.

## Evidencia visual

La captura 392×850 confirma que, con 72% de combustible, una estación todavía
mantiene icono, marcador y etiqueta grande sobre el mapa. También muestra el
vehículo pequeño y una cámara relativamente alejada alrededor de 56 km/h.
Estas observaciones son de composición visual automatizada; no demuestran
percepción de fluidez.

## Tres costos principales antes de optimizar

1. La cámara táctil de calidad media queda limitada por el perfil del dispositivo
   a 50 ms y el seguimiento normal aplica `jumpTo`, produciendo una cadencia
   nominal cercana a 20 Hz.
2. El marcador DOM de respaldo y la capa Three.js reciben actualizaciones del
   jugador en cada frame, aunque el respaldo esté oculto.
3. La combinación de actualizaciones GeoJSON, telemetría y renders periódicos de
   HUD mantiene trabajo sostenido sin registrar long tasks.

## Límites

- Chromium headless no demuestra fluidez percibida, temperatura, consumo,
  audio, hápticos ni comportamiento de GPU en teléfono físico.
- No existe todavía contador de cámara solicitada, omitida por intervalo u
  omitida por tolerancia.
- No existe todavía una medición fiable de input → actualización del
  `InputController` → cambio visual → consumo por el game loop.
- La prueba física de v0.2.5.1 sigue siendo la fuente de los hallazgos de
  movimiento escalonado y cámara menos fluida que vehículo/UI.

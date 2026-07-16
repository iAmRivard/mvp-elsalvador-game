# Baseline móvil v0.2.5.2

Fecha: 16 de julio de 2026. Commit base:
`1a9eb830e7ee03e709aa6d28143073d135ecb508`.

## Baseline histórico previo a cambios

La primera captura se realizó antes de modificar código:

- Build de producción normal servido con Vite Preview en Windows.
- Chromium headless con emulación Pixel 7.
- Viewport interior medido: 412×839; también se guardó control 392×850.
- Partida nueva, inicio de **La transmisión**, tutorial omitido y objetivo de
  velocidad de 59.7 km/h.
- 10 segundos de calentamiento y 30 segundos de observación.
- Duración total del capturador: 49.42 segundos.

| Métrica                                     | Captura histórica |
| ------------------------------------------- | ----------------: |
| FPS promedio instantáneo                    |             51.93 |
| FPS mediano instantáneo                     |             59.88 |
| Frametime promedio                          |         21.149 ms |
| Frametime p50                               |           16.7 ms |
| Frametime p95                               |           33.4 ms |
| Frametime p99                               |           33.4 ms |
| Frames >33 ms                               |               382 |
| Frames >50 ms                               |                 0 |
| Frames >100 ms                              |                 0 |
| Long tasks                                  |                 0 |
| Cámara aplicada/s                           |             17.67 |
| Cámara promedio                             |          1.281 ms |
| Cámara p95                                  |            1.9 ms |
| RoadTracker p95                             |            0.1 ms |
| Renders `MobileDrivingHud`                  |               151 |
| Ticks de telemetría observados              |               282 |
| Actualizaciones GeoJSON                     |               115 |
| Heap final expuesto por Chromium            |         45.20 MiB |
| Tiempo para seleccionar objetivo de 58 km/h |          1,112 ms |
| Latencia visual real de input               |               n/d |

La captura terminó en el estado visual **Vuelve a la ruta**. El escenario es
reproducible, pero no representa conducción ideal sobre el corredor durante los
30 segundos completos.

## Control v2 estrictamente comparable

Después de terminar el capturador v2 se repitió una corrida sobre el mismo
commit base en un worktree detached y limpio. Esto no altera el baseline: sirve
para comparar base y optimizado con exactamente la misma definición de FPS,
alcance del cronómetro y metadatos.

- SHA registrado por el capturador:
  `1a9eb830e7ee03e709aa6d28143073d135ecb508`.
- Build `production-normal`, sin diagnostics ni profiling.
- Mismo Pixel 7, recorrido, viewport, calidad, navegador, calentamiento y
  observación que el HEAD optimizado.
- FPS promedio se define como throughput:
  `frames observados / tiempo observado`.
- “FPS instantáneo promedio” conserva la media de `1000 / frametime`.
- Cámara mide llamada a MapLibre, exposición del objetivo y actualización del
  estado de seguimiento, igual en base y optimizado.

| Métrica                                     | Control base v2 |
| ------------------------------------------- | --------------: |
| FPS promedio por throughput                 |           46.11 |
| FPS promedio instantáneo                    |           50.98 |
| FPS mediano instantáneo                     |           59.88 |
| Frametime promedio                          |       21.687 ms |
| Frametime p50                               |         16.7 ms |
| Frametime p95                               |         33.4 ms |
| Frametime p99                               |         33.4 ms |
| Frames >33 ms                               |             416 |
| Frames >50 ms                               |               0 |
| Frames >100 ms                              |               0 |
| Long tasks                                  |               0 |
| Cámara solicitada/s                         |             n/d |
| Cámara aplicada/s                           |           17.13 |
| Cámara omitida por intervalo                |             n/d |
| Cámara omitida por tolerancia               |             n/d |
| Transiciones de cámara interrumpidas        |               0 |
| Cámara promedio                             |        1.275 ms |
| Cámara p95                                  |          1.7 ms |
| RoadTracker promedio                        |        0.058 ms |
| RoadTracker p95                             |          0.2 ms |
| Renders `MobileDrivingHud`                  |             153 |
| Actualizaciones Zustand totales             |             n/d |
| Ticks de telemetría observados              |             281 |
| Actualizaciones GeoJSON                     |             120 |
| Consultas MapLibre diagnósticas             |               0 |
| Heap final expuesto por Chromium            |       45.20 MiB |
| Tiempo para seleccionar objetivo de 58 km/h |        1,173 ms |
| Latencia visual real de input               |             n/d |

La frecuencia aplicada del control v2 se calculó con 514 muestras durante 30
segundos. El commit base todavía no exponía contadores separados de solicitudes
y omisiones.

## Tres costos principales antes de optimizar

1. La cámara táctil de calidad media quedaba limitada a 50 ms y aplicaba
   seguimiento nominal cercano a 20 Hz.
2. El marcador DOM de respaldo y la capa Three.js recibían actualizaciones del
   jugador en cada frame, aunque el respaldo estuviera oculto.
3. Actualizaciones GeoJSON, telemetría y renders periódicos de HUD mantenían
   trabajo sostenido, aunque no se registraran long tasks.

## Límites

- Chromium headless no demuestra fluidez percibida, temperatura, consumo,
  audio, hápticos ni comportamiento de GPU en teléfono físico.
- La métrica vial cronometra la búsqueda espacial muestreada, no todo
  `RoadTracker.update`.
- Los ticks de telemetría no equivalen a todas las escrituras de Zustand.
- La prueba física de v0.2.5.1 sigue siendo la fuente de los hallazgos de
  movimiento escalonado y cámara menos fluida que vehículo/UI.

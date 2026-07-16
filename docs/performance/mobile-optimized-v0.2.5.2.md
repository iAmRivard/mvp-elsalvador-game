# Optimización móvil v0.2.5.2

Fecha: 16 de julio de 2026.

- Commit base: `1a9eb830e7ee03e709aa6d28143073d135ecb508`.
- SHA de runtime medido:
  `a30ae66c28b2ee0e6ec8eda640af6545423968dc`.

## Protocolo

- Build de producción normal, sin `VITE_ENABLE_PROFILING`, servido con Vite
  Preview en Windows.
- Chromium headless con emulación Pixel 7.
- Mismo inicio, ruta, calidad, navegador y capturador v2 del control base.
- 10 segundos de calentamiento y 30 segundos de observación.
- Tres corridas sobre el mismo SHA y build.
- Los valores optimizados son la mediana de las tres corridas; los rangos se
  conservan abajo.
- Cada JSON registra SHA, modo de build, fecha, URL, versión de esquema y
  alcance de los cronómetros.

La automatización mide frame pacing y costos instrumentados. No demuestra
fluidez percibida, temperatura ni respuesta en un teléfono físico.

## Comparación estricta con el control base v2

| Métrica                          | v0.2.5.1/base |  v0.2.5.2 |           Cambio |
| -------------------------------- | ------------: | --------: | ---------------: |
| FPS promedio por throughput      |         46.11 |     50.67 |            +9.9% |
| FPS promedio instantáneo         |         50.98 |     54.48 |            +6.9% |
| FPS mediano instantáneo          |         59.88 |     59.88 |               0% |
| Frametime promedio               |     21.687 ms | 19.734 ms |            -9.0% |
| Frametime p50                    |       16.7 ms |   16.7 ms |               0% |
| Frametime p95                    |       33.4 ms |   33.4 ms |               0% |
| Frametime p99                    |       33.4 ms |   33.4 ms |               0% |
| Frames >33 ms                    |           416 |       280 |           -32.7% |
| Frames >50 ms                    |             0 |         0 |                0 |
| Frames >100 ms                   |             0 |         0 |                0 |
| Cámara solicitada/s              |           n/d |     51.37 |            nueva |
| Cámara aplicada/s                |         17.13 |     28.60 |           +66.9% |
| Cámara omitida por intervalo     |           n/d |       676 |            nueva |
| Cámara omitida por tolerancia    |           n/d |         0 |            nueva |
| Cámara promedio                  |      1.275 ms |  1.482 ms |        +0.207 ms |
| Cámara p95                       |        1.7 ms |    2.2 ms |          +0.5 ms |
| RoadTracker p95                  |        0.2 ms |    0.1 ms |          -0.1 ms |
| Renders `MobileDrivingHud`       |           153 |       151 |               -2 |
| Actualizaciones Zustand totales  |           n/d |       n/d |              n/d |
| Ticks de telemetría observados   |           281 |       283 |               +2 |
| Actualizaciones GeoJSON          |           120 |       113 |            -5.8% |
| Long tasks                       |             0 |         0 |                0 |
| Tiempo para seleccionar 58 km/h  |      1,173 ms |  1,156 ms |            -1.4% |
| Latencia visual real de input    |           n/d |       n/d |              n/d |
| Evento → próximo RAF             |           n/d |   53.7 ms | nueva, profiling |
| Heap final expuesto por Chromium |     45.20 MiB | 57.51 MiB |         variable |

Rangos de las tres corridas normales:

- FPS por throughput: 49.14–51.37.
- FPS instantáneo promedio: 53.37–54.96.
- Frametime promedio: 19.467–20.349 ms.
- Frames >33 ms: 259–326.
- Cámara solicitada: 49.63–52.03 solicitudes/s.
- Cámara aplicada: 28.37–28.83 actualizaciones/s.
- Cámara omitida por intervalo: 638–703.
- Cámara promedio: 1.277–1.603 ms.
- Cámara p95: 1.7–2.7 ms; las tres corridas cumplen menos de 3 ms.
- GeoJSON: 109–115 actualizaciones.
- Tiempo para seleccionar 58 km/h: 1,138–1,210 ms.
- Heap final expuesto por Chromium: 54.17–61.04 MiB.
- Ninguna corrida normal añadió frames >50 ms, frames >100 ms o long tasks.

El p95 de cámara cumple el objetivo en las tres corridas. La variación de heap
no se interpreta como regresión sin perfil de memoria dedicado.

## Cámara

- Calidad móvil media/alta: intervalo objetivo de 33 ms.
- Calidad móvil baja: intervalo objetivo de 50 ms.
- Desktop: 33 ms.
- El seguimiento comprueba primero el intervalo y después calcula el objetivo
  completo.
- `jumpTo` omite zoom y pitch cuando el perfil no cambió de forma
  significativa.
- La métrica de cámara usa el mismo límite en base y optimizado: llamada a
  MapLibre, `exposeCameraTarget` y bookkeeping de seguimiento.
- Contadores y último costo son ligeros; arrays, percentiles y diagnósticos
  pesados sólo se habilitan con diagnostics o profiling.
- Tolerancias configurables:
  - coordenadas: `0.00000015°`;
  - bearing: `0.35°`;
  - velocidad de perfil: `0.5 km/h`;
  - zoom: `0.01`;
  - pitch: `0.1°`;
  - offset: `0.75 px`.
- El perfil rápido móvil entra a 84 km/h después de 900 ms sostenidos y sale a
  74 km/h después de 650 ms.
- La transición pendiente sigue evaluándose con el vehículo quieto, de modo que
  `mobileFast` termina correctamente en `mobileStopped`.
- `mobileDriving` usa zoom 15.45 y `mobileFast` 15.20 para conservar cercanía.

El escenario continuo no produjo omisiones por tolerancia. Las pruebas puras
verifican cambios pequeños y significativos, y el E2E táctil verifica la
restauración completa al detenerse.

## Input

`timeToSelect58KphTargetMilliseconds` conserva la medición histórica con un
nombre explícito. No se presenta como latencia.

Una captura separada `production-profiling`, sobre el mismo SHA, registró:

- evento → almacenado en `InputController`: 50.2 ms;
- evento → consumido por el game loop: 52.8 ms;
- evento → próximo `requestAnimationFrame`: 53.7 ms;
- latencia visual/presentación real: n/d.

El próximo RAF no confirma pintura ni presentación en pantalla. CDP, Chromium
headless y la cola de eventos limitan la precisión; estos valores sólo ayudan a
detectar regresiones grandes. La validación táctil física sigue pendiente.

## Tutorial, overlays y UI

- El tutorial obligatorio termina en cinco pasos: girar, elegir velocidad,
  mantener marcha, frenar y seguir la ruta.
- `navigation-basics` reanuda el quinto paso; `interaction-basics` legado migra
  a `completed`.
- Objetivo, interacción, Turbo y bitácora son consejos pequeños, no pausantes y
  deduplicados por sesión.
- La política de overlays monta como máximo un panel informativo grande y
  prioriza narrativa, recuperación/elección, interacción, tutorial, radio,
  consejo, mini navegador y alertas.
- La radio móvil muestra 4.5 segundos completos y luego se contrae sin descartar
  el evento. La franja puede expandirse.
- Con más de 35% de combustible y misión activa, estaciones no seleccionadas
  quedan como iconos discretos. Entre 25% y 35% usan formato compacto; bajo 25%
  muestran asistencia completa.
- El vehículo móvil creció 12%, el tramo inmediato de ruta pasó de 8 a 8.5 px y
  la cámara rápida quedó más cerca. No se modificó la física.

El E2E 392×850 completa los cinco pasos con eventos táctiles CDP reales y
confirma conducción libre antes de 30 segundos. Después valida objetivo,
interacción con clic real, Turbo, bitácora, colapso/reapertura de radio y
prioridad visual de combustible.

## Costos y límites restantes

- El p95 de frametime continúa cuantizado en 33.4 ms en Chromium headless; no se
  alcanzó una reducción de 25% en esa métrica, aunque los frames >33 ms bajaron
  32.7% en el control estrictamente comparable.
- La cámara aplicada queda cerca de 30 Hz, no exactamente en 30 Hz, por la
  cadencia real de frames y el filtro de intervalo.
- `cameraSkippedByTolerance` necesita un escenario detenido o casi estático
  para producir un contador representativo.
- Los ticks observados no equivalen a todas las escrituras de Zustand.
- Siguen pendientes teléfono físico, sesión de 15 minutos, calentamiento,
  audio, hápticos, safe areas y sensación subjetiva de cámara/velocidad.

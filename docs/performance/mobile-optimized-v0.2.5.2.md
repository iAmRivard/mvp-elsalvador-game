# Optimización móvil v0.2.5.2

Fecha: 16 de julio de 2026. Commit base:
`1a9eb830e7ee03e709aa6d28143073d135ecb508`.

## Protocolo

- Build de producción con `VITE_ENABLE_PROFILING=true`, servido con Vite
  Preview en Windows.
- Chromium headless con emulación Pixel 7.
- Mismo inicio, ruta, calidad, navegador y capturador del baseline.
- 10 segundos de calentamiento y 30 segundos de observación.
- Tres corridas sobre el mismo código final de medición.
- Los valores de comparación son la mediana de las tres corridas. Los rangos
  se documentan cuando ayudan a mostrar variabilidad.

Esta automatización mide frame pacing y costos instrumentados. No demuestra
fluidez percibida, temperatura ni respuesta en un teléfono físico.

## Comparación

| Métrica | v0.2.5.1/base | v0.2.5.2 | Cambio |
| --- | ---: | ---: | ---: |
| FPS promedio | 51.93 | 54.26 | +4.5% |
| FPS mediano | 59.88 | 59.88 | 0% |
| Frametime promedio | 21.149 ms | 19.852 ms | -6.1% |
| Frametime p50 | 16.7 ms | 16.7 ms | 0% |
| Frametime p95 | 33.4 ms | 33.4 ms | 0% |
| Frametime p99 | 33.4 ms | 33.4 ms | 0% |
| Frames >33 ms | 382 | 289 | -24.3% |
| Frames >50 ms | 0 | 0 | 0 |
| Frames >100 ms | 0 | 0 | 0 |
| Cámara solicitada/s | n/d | 50.90 | nueva |
| Cámara aplicada/s | 17.67 | 28.47 | +61.1% |
| Cámara omitida por intervalo | n/d | 673 | nueva |
| Cámara omitida por tolerancia | n/d | 0 | nueva |
| Cámara promedio | 1.281 ms | 1.395 ms | +0.114 ms |
| Cámara p95 | 1.9 ms | 2.1 ms | +0.2 ms |
| RoadTracker p95 | 0.1 ms | 0.2 ms | +0.1 ms |
| Renders `MobileDrivingHud` | 151 | 151 | 0 |
| Actualizaciones Zustand totales | n/d | n/d | n/d |
| Ticks de telemetría observados | 282 | 282 | 0 |
| Actualizaciones GeoJSON | 115 | 110 | -4.3% |
| Long tasks | 0 | 0 | 0 |
| Tiempo para seleccionar 58 km/h | 1,112 ms | 1,135 ms | +2.1% |
| Latencia visual de input | n/d | 49.6 ms | nueva |

Rangos de las tres corridas finales:

- FPS promedio: 53.71–54.44.
- Frametime promedio: 19.760–20.172 ms.
- Frames >33 ms: 282–312.
- Cámara aplicada: 27.67–28.50 actualizaciones/s.
- Cámara promedio: 1.309–1.788 ms.
- Cámara p95: 1.7–3.4 ms. Dos corridas quedaron bajo 3 ms; el valor de
  3.4 ms coincidió con la única long task observada en las tres corridas.
- GeoJSON: 88–120 actualizaciones.
- Latencia visual de input: 48.1–61.6 ms.
- Heap final expuesto por Chromium: 42.63–68.86 MiB.

La mediana de cámara p95 cumple el objetivo de menos de 3 ms. La corrida
atípica se conserva en el informe; no se descartó ni se sustituyó.

## Cámara

- Calidad móvil media/alta: intervalo objetivo de 33 ms.
- Calidad móvil baja: intervalo objetivo de 50 ms.
- Desktop: 33 ms.
- El seguimiento comprueba primero el intervalo y después calcula el objetivo
  completo.
- `jumpTo` omite zoom y pitch cuando el perfil no cambió de forma
  significativa.
- Las escrituras de diagnóstico quedaron fuera del cronómetro de aplicación de
  cámara.
- Tolerancias configurables:
  - coordenadas: `0.00000015°`;
  - bearing: `0.35°`;
  - velocidad de perfil: `0.5 km/h`;
  - zoom: `0.01`;
  - pitch: `0.1°`;
  - offset: `0.75 px`.
- El perfil rápido móvil entra a 84 km/h después de 900 ms sostenidos y sale a
  74 km/h después de 650 ms.
- `mobileDriving` usa zoom 15.45 y `mobileFast` 15.20 para conservar cercanía.

El escenario de medición mantiene movimiento continuo, por lo que no generó
omisiones netas por tolerancia. Las pruebas puras sí verifican cambios pequeños
y significativos. No hubo transiciones interrumpidas en la corrida de control.

## Input

`timeToSelect58KphTargetMilliseconds` conserva la medición anterior con un
nombre explícito. No se presenta como latencia.

La instrumentación nueva, habilitada solo con profiling o diagnostics, registra:

1. timestamp del evento de puntero;
2. momento posterior a almacenar el valor en `InputController`;
3. siguiente consumo por el game loop;
4. siguiente `requestAnimationFrame` que confirma el cambio visual del joystick.

Medianas headless:

- evento → almacenado: 45.9 ms;
- evento → consumido: 48.8 ms;
- evento → frame visual: 49.6 ms.

CDP, Chromium headless y la cola de eventos limitan la precisión. Estos valores
sirven para detectar regresiones grandes, no como medición táctil física.

## Tutorial, overlays y UI

- El tutorial obligatorio termina en cinco pasos: girar, elegir velocidad,
  mantener marcha, frenar y seguir la ruta.
- `navigation-basics` reanuda el quinto paso; `interaction-basics` legado migra
  a `completed`.
- Objetivo, interacción, Turbo y bitácora son consejos pequeños, no pausantes y
  deduplicados por sesión.
- La cola monta como máximo un overlay grande y ordena narrativa, recuperación
  o elección, tutorial, radio y avisos compactos.
- La radio móvil muestra 4.5 segundos completos y luego se contrae sin
  descartar el evento. La franja puede expandirse.
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
  alcanzó una reducción del 25% porque el baseline comparable ya alternaba
  principalmente entre frames de 16.7 y 33.4 ms.
- La cámara aplicada queda cerca de 30 Hz, no exactamente en 30 Hz, por la
  cadencia real de frames y el filtro de intervalo.
- `cameraSkippedByTolerance` necesita un escenario detenido o casi estático para
  producir un contador representativo.
- Los ticks observados no equivalen a todas las escrituras de Zustand.
- La memoria de Chromium es orientativa y varió ampliamente entre corridas.
- Siguen pendientes teléfono físico, sesión de 15 minutos, calentamiento,
  audio, hápticos, safe areas y sensación subjetiva de cámara/velocidad.

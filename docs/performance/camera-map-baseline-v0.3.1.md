# Baseline v0.3.1 — cámara y legibilidad del mapa

## Identidad

- Base real de `main`: `8d7d75ddb0cfeb7331309ff7f369ba0731ee2090`.
- SHA de producto medido: `4deb46d93118010eed63ccc9174852c41ded8e6d`.
- Rama de trabajo: `codex/v0.3.1-camera-map-readability`.
- Node: `v24.18.0`; npm: `11.16.0`; paquete: `0.3.0`.
- Chromium headless: `149.0.7827.55`, emulación Pixel 7.
- Viewport: `392 × 850`; DPR: `2.625`.
- Build de producción; diagnósticos deshabilitados.

El SHA `4deb46d` contiene únicamente el capturador y los perfiles de prueba; su
comportamiento de producto coincide con la base real. La primera observación de
15 s se invalidó durante la revisión porque el protocolo permanente exige al
menos 30 s. Los resultados siguientes reemplazan esa corrida.

Para hacer comparable la proyección antes/después, el worktree aislado del
baseline recibió solo instrumentación temporal: una lectura `map.project` a
4 Hz en `onVisualUpdate`. No se incorporó comportamiento de v0.3.1. El
artefacto marca `instrumentedBaseline: true` y conserva tanto `repositorySha`
como `buildSha` en `4deb46d`.

## Escenario reproducible

- Warm-up: 5 s.
- Observación: 30 s (`30,053.9 ms` capturados).
- Un worker, cero retries.
- Misma posición inicial y ruta de la primera investigación.
- Touch CDP real: aceleración, crucero, tramo rápido y giro.
- Capturas: detenido, aceleración, 30–50 km/h, rápido y curva.
- Fuente de proyección: `player-projection` a 4 Hz, muestreada desde RAF.

Los artefactos locales están en `test-results/camera-map-v0.3.1-baseline-30s`
del worktree aislado y no se versionan.

## Inventario inicial

- Cámara móvil detenida: zoom `15.65`, pitch `55°`, ancla Y `0.58`.
- Cámara móvil en conducción: zoom `15.55`, pitch `58°`, ancla Y `0.62`.
- Cámara móvil rápida: zoom `15.40`, pitch `59.5°`, ancla Y `0.60`.
- Centro solicitado: coordenada exacta del vehículo.
- Bearing máximo: `12°` por actualización, no por tiempo.
- Cadencias posibles: 20, 30, 45 y 60 Hz.
- Estilo: una sola capa de lugares mezcla city/town/village/municipality.
- POI genéricos siguen participando en colocación durante gameplay.

## Resultados baseline comparables

| Métrica                                   |                    Baseline 30 s |
| ----------------------------------------- | -------------------------------: |
| Posiciones proyectadas distintas (0.1 px) |                               37 |
| Movimiento consecutivo promedio           |                         0.105 px |
| Movimiento consecutivo p50                |                             0 px |
| Movimiento consecutivo p95                |                         0.470 px |
| Movimiento consecutivo p99                |                         0.960 px |
| Transición máxima                         |                         42.90 px |
| Cámara aplicada                           |          28.65 actualizaciones/s |
| Cámara promedio                           |                         1.627 ms |
| Cámara p95                                |                           2.4 ms |
| Cámara p99                                |                           3.1 ms |
| Intervalo de cámara p95                   |                          43.2 ms |
| Intervalo de cámara p99                   |                          86.4 ms |
| Frametime promedio                        |                         20.52 ms |
| Frametime p50                             |                          16.7 ms |
| Frametime p95                             |                          33.4 ms |
| Frametime p99                             |                          33.5 ms |
| Frames >33 ms                             |                              273 |
| Frames >50 ms                             |                               14 |
| Frames >100 ms                            |                                5 |
| Cadencia final                            |                            30 Hz |
| Zoom/pitch final                          |                      15.55 / 58° |
| Área útil final                           |                            75.9% |
| Vehículo fuera del viewport seguro        |                               no |
| Capas `symbol` visibles                   |        n/a; contador inexistente |
| Etiquetas renderizadas                    | n/a; diagnósticos deshabilitados |

## Diagnóstico

El p50 de movimiento en cero y solo 37 posiciones distintas durante 30 s
confirman el anclaje visual. La transición máxima corresponde al cambio de
perfil/ancla. La cámara cumple p95 <3 ms, pero el vehículo no expresa
aceleración o giro dentro de una zona propia. POI, lugares locales y edificios
compiten con ruta/objetivo, y detenerse durante una misión restaura demasiado
detalle.

Esta prueba headless no demuestra suavidad percibida, temperatura, consumo,
audio, hápticos ni frame pacing de un teléfono físico.

# Baseline v0.3.1 — Cámara y legibilidad del mapa

## Identidad y alcance

- Base real de `main`: `8d7d75ddb0cfeb7331309ff7f369ba0731ee2090`.
- SHA medido: `4deb46d93118010eed63ccc9174852c41ded8e6d`.
- Diferencia de producto respecto a la base: ninguna; los commits intermedios
  añaden únicamente perfiles de prueba y el capturador.
- Rama: `codex/v0.3.1-camera-map-readability`.
- Worktree al medir: limpio.
- Node: `v24.18.0`.
- npm: `11.16.0`.
- Versión del paquete: `0.3.0`.
- Chromium headless: `149.0.7827.55`, emulación Pixel 7.
- Viewport: `392×850`, DPR `2.625`.
- Build: producción normal.
- Diagnósticos: deshabilitados.
- Warm-up: 5 s.
- Observación solicitada: 15 s; ventana capturada: `15,060.6 ms`.
- Input: eventos touch CDP reales.

Esta captura no es una prueba física. No demuestra suavidad percibida,
temperatura, consumo, hápticos ni frame pacing de un teléfono real.

## Inventario inicial

### Perfiles de cámara móvil

| Perfil              |  Zoom | Pitch | Ancla Y | Intervalo configurado |
| ------------------- | ----: | ----: | ------: | --------------------: |
| `mobileStopped`     | 15.65 |   55° |    0.58 |                 33 ms |
| `mobileDriving`     | 15.55 |   58° |    0.62 |                 33 ms |
| `mobileFast`        | 15.40 | 59.5° |    0.60 |                 33 ms |
| `mobileInteraction` | 15.65 |   55° |    0.58 |                 33 ms |
| `mobileRecovery`    | 15.35 |   55° |    0.60 |                 33 ms |

La cámara solicita como centro la coordenada exacta del vehículo. El offset
vertical la proyecta de nuevo a un ancla fija del viewport seguro.

### Cadencia

- Cadencias posibles: 20, 30, 45 y 60 Hz.
- Inicio: 20 Hz si el perfil del dispositivo solicita 45 ms o más; 30 Hz en
  los demás casos.
- Máximo: 30 Hz en calidad baja, 45 Hz en media y 60 Hz en alta.
- Promoción: tres ventanas saludables de al menos 4 s.
- Democión desde más de 30 Hz: dos ventanas no saludables.
- El límite de bearing es 12° por actualización, no por segundo.

### Símbolos y detalle de mapa

El estilo base contiene dos capas `symbol`:

- `place-labels`: city, town, village y municipality juntos.
- `poi-labels`: todos los POI genéricos.

Las capas dinámicas de ruta añaden chevrones. El perfil `driving` reduce POI a
opacidad 0.06, pero no usa `visibility: none`, por lo que siguen participando
en colocación y colisiones. El controlador consulta `getStyle()` en cada
`apply`, incluso si el modo no cambió.

### Playwright y comandos iniciales

Proyectos: `chromium-desktop`, `chromium-mobile`,
`chromium-mobile-landscape`, `chromium-pwa` y `chromium-onboarding`.

Comandos previos: `test`, `test:watch`, `test:e2e` y `check`. No existían
perfiles rápidos por cambios, rama, smoke, cámara o mapa.

La auditoría inicial obtuvo:

- `npm run typecheck`: 4.9 s, verde.
- Cinco archivos Vitest enfocados: 43/43, 2.2 s de comando.
- Bucle interno E2E comparable previo: n/a; no existía un perfil enfocado.

El perfil nuevo `test:e2e:smoke` ejecutó build y ocho pasos esenciales en
14.6 s, con un worker, cero retries y primer fallo bloqueante.

## Escenario

La secuencia usa la posición inicial y ruta de la primera investigación:

1. Estado detenido después de 5 s de warm-up.
2. Aceleración con objetivo aproximado de 30–50 km/h.
3. Crucero corto en ese rango.
4. Objetivo rápido de 70–90 km/h.
5. Giro táctil hacia la guía disponible.

Se guardaron capturas para detenido, aceleración, crucero, rápido y curva en el
artefacto local `test-results/camera-map-baseline-v0.3.1`. Ese directorio no se
versiona.

## Resultados

| Métrica                                      |                               Baseline |
| -------------------------------------------- | -------------------------------------: |
| Proyección inicial del vehículo              |                          (196, 389) px |
| Proyección final del vehículo                |                          (196, 455) px |
| Distancia consecutiva promedio               |                               0.174 px |
| Distancia consecutiva p50                    |                                   0 px |
| Distancia consecutiva p95                    |                                   0 px |
| Distancia consecutiva p99                    |                                   0 px |
| Posiciones proyectadas redondeadas distintas |                                      5 |
| Centro visual de cámara                      |                          (196, 425) px |
| Cámara aplicada                              |                27.36 actualizaciones/s |
| Cámara promedio                              |                               1.520 ms |
| Cámara p95                                   |                                 2.2 ms |
| Cámara p99                                   |                                 2.8 ms |
| Intervalo de cámara p50                      |                                34.4 ms |
| Intervalo de cámara p95                      |                                50.7 ms |
| Intervalo de cámara p99                      |                               114.0 ms |
| Frametime promedio                           |                               21.42 ms |
| Frametime p50                                |                                16.7 ms |
| Frametime p95                                |                                33.4 ms |
| Frametime p99                                |                               100.0 ms |
| Frames >33 ms                                |                                    134 |
| Frames >50 ms                                |                                     12 |
| Frames >100 ms                               |                                      5 |
| Cadencia final reportada                     |                                  30 Hz |
| Zoom final                                   |                                  15.55 |
| Pitch final                                  |                                    58° |
| Área útil final                              |                                  75.9% |
| Vehículo fuera del viewport seguro           |                                     no |
| Capas symbol visibles                        | n/a; no existía contador de bajo costo |
| Etiquetas renderizadas                       |       n/a; diagnósticos deshabilitados |

La fuente de proyección baseline es `exact-follow-target-fallback`: antes de
v0.3.1 el objetivo aplicado de cámara es exactamente el jugador, por lo que la
proyección se puede derivar del offset aplicado. La implementación optimizada
debe exponer la proyección real del jugador y no reutilizar esta inferencia.

## Diagnóstico

El p50, p95 y p99 de movimiento consecutivo en 0 px confirman que el vehículo
permanece anclado al mismo píxel entre cambios discretos de perfil. El máximo de
43 px coincide con cambios de ancla/perfil, no con libertad natural durante la
conducción. La cámara queda por debajo de 3 ms en p95, pero las aplicaciones
efectivas quedan por debajo de 30 por segundo y el intervalo p99 supera 100 ms.

La captura detenida muestra simultáneamente POI comerciales, lugares locales,
edificios, marcadores DOM y ruta. Al conducir rápido se reduce el detalle, pero
la restauración al detenerse durante la misión vuelve a introducir la densidad
completa. Estas observaciones son visuales del Chromium headless y deben
confirmarse en el playtest físico.

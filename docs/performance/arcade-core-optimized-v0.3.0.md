# Arcade Core v0.3.0 — resultado optimizado

## Identidad y método

- Fecha: 2026-07-17.
- Base: `607a12d6de95359ae95235e7e4034fe7287705a3`.
- Candidato medido: `db7ca8bf3f495977f7f0ba16fbb885e3ad968db6`.
- Los commits posteriores a `1a8de1021b4547bb848ea4626a873f3876dcd129`
  solo endurecen pruebas, capturas y documentación; no cambian el runtime del
  juego. El commit documental de cierre es posterior al candidato medido.
  Docker y CI se validan sobre el SHA final exacto después de ese commit.
- Entorno: Windows, Node `v24.18.0`, npm `11.16.0`, Chromium
  `149.0.7827.55` headless, Pixel 7, viewport `392×850`, DPR 2.
- Contrato schema 5: save/settings deterministas, red vial `ready`, ruta
  `idle`, semilla fija, checkpoint en la troncal `10999`, heading `244.8°`,
  touch CDP real de 0.28 radios durante 2200 ms, 10 s de warm-up y 30 s de
  observación.
- Baseline y final: tres repeticiones limpias por candidato. El capturador
  rechazó worktree sucio, SHA de build distinto al repositorio, ruta fallback,
  superficie/edge incompatibles y trayectorias o cargas dinámicas divergentes.
- Diagnostics y profiling de producción: desactivados.
- Esto no es una medición de teléfono físico.

Artefactos locales:
`test-results/performance-schema5-db7ca8b/{baseline,final}/run-1..3` y
`test-results/performance-schema5-db7ca8b/comparison.json`.

## Resultado de frame pacing

| Métrica                  | Base mediana | Final mediana |    Final min–max |  Cambio |
| ------------------------ | -----------: | ------------: | ---------------: | ------: |
| FPS throughput           |       53.173 |        52.240 |    51.469–52.506 |  -1.75% |
| FPS instantáneo promedio |       56.148 |        55.541 |    55.027–55.722 |  -1.08% |
| Frametime promedio       |    18.807 ms |     19.143 ms | 19.045–19.429 ms |  +1.79% |
| Frametime p50            |      16.7 ms |       16.7 ms |     16.7–16.7 ms |      0% |
| Frametime p95            |      33.3 ms |       33.4 ms |     33.3–33.4 ms | +0.1 ms |
| Frametime p99            |      33.4 ms |       33.4 ms |     33.4–33.4 ms |      0% |
| Frames >33 ms            |          205 |           233 |          225–256 | +13.66% |
| Frames >50 ms            |            0 |             0 |              0–0 |       0 |
| Frames >100 ms           |            0 |             0 |              0–0 |       0 |
| Long tasks               |            0 |             0 |              0–0 |       0 |

El p95 cambia 0.1 ms, exactamente un escalón de la resolución expuesta por el
timer headless, y los rangos base/final se superponen. No aparecen frames
`>50 ms` o `>100 ms` ni long tasks. Throughput, frametime medio y frames apenas
mayores de 33 ms todavía empeoran frente a la mediana base. No se declara una
mejora global de frame pacing; el resultado se considera equivalente en los
gates críticos y debe contrastarse en teléfonos físicos.

## Costes del runtime

| Métrica                 | Base mediana | Final mediana |     Final min–max |             Cambio |
| ----------------------- | -----------: | ------------: | ----------------: | -----------------: |
| Cámara promedio         |     2.676 ms |      1.616 ms |    1.603–1.707 ms |            -39.60% |
| Cámara p95              |       4.0 ms |        2.4 ms |        2.3–2.5 ms |            -40.00% |
| Cámara aplicada         |     29.000/s |      30.333/s |   30.333–30.400/s |             +4.60% |
| RoadTracker p95         |       0.1 ms |        0.1 ms |        0.1–0.1 ms |                 0% |
| GeoJSON / 30 s          |            0 |             0 |               0–0 |                 0% |
| Three jugador / 30 s    |         1565 |          1532 |         1513–1538 |             -2.11% |
| MobileDrivingHud / 30 s |          150 |           150 |           150–150 |                 0% |
| Heap final expuesto     |   42.629 MiB |    45.204 MiB | 42.629–45.204 MiB | +6.04%; cuantizado |
| Área útil de mapa       |          n/d |         75.9% |        75.9–75.9% |                n/d |

La cámara final cumple p95 <3 ms en las tres corridas. No hubo
`queryRenderedFeatures` con diagnostics
apagado. Los tres arquetipos comparten un único GLB local provisional y no se
cargan tres modelos. El heap está cuantizado y su rango no permite inferir una
mejora de memoria.

## Equivalencia de carga dinámica

| Métrica             |      Base mediana (min–max) |     Final mediana (min–max) |
| ------------------- | --------------------------: | --------------------------: |
| Muestras / 30 s     |               121 (121–121) |               121 (121–122) |
| Velocidad media     | 63.609 (63.558–63.623) km/h | 63.672 (63.141–63.753) km/h |
| Objetivo medio      | 62.300 (62.300–62.300) km/h | 62.300 (61.800–62.300) km/h |
| Distancia observada |    2645.5 (2642.9–2655.1) m |    2649.2 (2634.2–2656.8) m |
| Superficie `trunk`  |                        100% |                        100% |
| Edge `10999`        |                        100% |                        100% |
| Ruta `idle`         |                        100% |                        100% |
| Heading `244.8°`    |                        100% |                        100% |

El comparador aprobó equivalencia interna de cada grupo y cada par
baseline/final. Antes de obtener este lote se descartaron, sin usarlos como
evidencia, cuatro diseños o tandas: una ruta automática que entraba en
`fallback`, un corredor demasiado corto, un release dependiente de polling que
producía objetivos distintos y el gesto fuerte fijo de 1 s cuya tanda base
terminó en 58.7/59.7/60.6 km/h. El último fue rechazado automáticamente por el
contrato. El gesto v3 conserva interacción física CDP y reduce el salto máximo
por frame sin tocar el store ni relajar umbrales.

## Movimiento inmediato y reversa

El escenario móvil completo pasó 10/10 repeticiones funcionales sobre el
runtime final, con un worker y cero retries. Cinco repeticiones adicionales
conservaron el adjunto JSON de telemetría para calcular estos valores:

| Métrica                            | Mediana | Mínimo | Máximo |    Criterio |
| ---------------------------------- | ------: | -----: | -----: | ----------: |
| Evento touch → input almacenado    | 60.0 ms |   53.9 |   61.3 | observación |
| Evento touch → input consumido     | 61.9 ms |   55.9 |   64.0 | observación |
| Consumo → primera posición         |  0.2 ms |    0.1 |    0.3 |     <250 ms |
| Evento touch → primera posición    | 62.2 ms |   56.1 |   64.1 |        <1 s |
| Evento touch → primer frame visual | 46.7 ms |   40.0 |   58.7 |        <1 s |
| Movimiento visible total           |  281 ms |    255 |    292 |        <1 s |
| 10 km/h                            |  566 ms |    545 |    609 |        <1 s |
| 20 km/h                            |  838 ms |    791 |    933 |        <2 s |
| 30 km/h                            | 1104 ms |   1081 |   1199 |        <3 s |

Las mismas 10 repeticiones validaron crucero al soltar, frenado y la secuencia
segura detener → soltar → segundo gesto para reversa. Las tres capturas schema
5 midieron touch → almacenado en 38.7 ms (35.0–39.7), touch → consumo en
39.3 ms (35.6–40.2) y selección del objetivo ≥58 km/h en 2379 ms
(2361–2395). Este último tiempo incluye deliberadamente el gesto suave de
2200 ms usado para estabilizar la carga comparativa; no representa el tiempo de
arranque del modo arcade.

Un primer intento de la tanda 10× fue inválido: el preview había terminado por
su límite de una hora y los diez casos fallaron en `page.goto` con
`ERR_CONNECTION_REFUSED` antes de abrir el juego. Se verificó la causa, se
reinició el mismo build y la tanda válida pasó 10/10 sin retries. Este incidente
no se cuenta como fallo de gameplay ni se oculta.

## Primeros cinco minutos

Tres sesiones completas de 300 s se capturaron sobre
`1a8de1021b4547bb848ea4626a873f3876dcd129`. Los commits hasta el candidato
schema 5 no cambian el runtime de producción usado por ese runner:

- 3/3 terminaron con red vial `ready`, ruta `road`, cero overlays y Torogoz.
- 0 ms inmóvil y cero recuperaciones registradas en las tres sesiones.
- 11 capturas por sesión: 0, 1, 3, 8, 15, 30, 45, 75, 120, 180 y 300 s.
- Primer evento/recompensa: mediana 2051 ms, rango 2012–2190 ms.
- Área útil al cierre: mediana 72.0%, rango 72.0–81.2%.
- El evento de radio entrega la primera recompensa durable; el runner no
  completa objetivos ni asigna recompensas mediante el store.
- Artefactos locales: `artifacts/five-minutes/head-1a8de10/run1..3`.

## Repeticiones enfocadas del runtime final

- Suite E2E completa serial, cero retries: 66 aprobadas, 57 omitidas por
  matriz/proyecto, 0 fallos; dos pasadas consecutivas de 8.9 y 9.0 min.
- Movimiento arcade y reversa: 10/10; telemetría detallada adicional: 5/5.
- Reincorporación: 5/5 cerca de vía, 5/5 fuera del límite y 5/5 dentro de un
  objetivo offroad legítimo.
- Cámara/HUD/safe viewport: 5/5 por cada viewport `392×850`, `412×915`,
  `850×392`, `768×1024` y `360×640`; perfiles de cámara: 5/5.
- Garaje/cambio de vehículo/persistencia: 5/5.
- PWA con service worker habilitado: dos escenarios × 3 repeticiones, 6/6.
- Offroad: 42 pruebas puras × 5 repeticiones, 210/210.
- Guardados, configuración y fallback de vehículo: 36 pruebas puras × 5
  repeticiones, 180/180.
- Cinco minutos: 3/3 sesiones de 300 s.

## Límites

Tiempo preciso de carga del modelo y de cambio de vehículo: n/d. Escrituras
Zustand, GPU, repaints MapLibre, latencia de presentación/primer frame visual
del contrato schema 5, batería, temperatura, audio real, haptics y diversión:
n/d. El timer headless muestra cuantización alrededor de
16.7/33.4 ms. Heap es una lectura de Chromium, no memoria total del proceso o
GPU. Ninguna cifra demuestra diversión, comodidad, ausencia de mareo o
sostenibilidad térmica.

# Arcade Core v0.3.0 — resultado optimizado

## Identidad y método

- Fecha: 2026-07-17.
- Base: `607a12d6de95359ae95235e7e4034fe7287705a3`.
- Runtime final medido: `1a8de1021b4547bb848ea4626a873f3876dcd129`.
- El commit documental de cierre es posterior al runtime medido y no cambia
  código, assets ni configuración de ejecución. Docker y CI se validan sobre el
  SHA final exacto después de ese commit.
- Entorno: Windows, Node `v24.18.0`, npm `11.16.0`, Chromium
  `149.0.7827.55` headless, Pixel 7, viewport `392×850`, DPR 2.
- Contrato schema 4: almacenamiento limpio, partida nueva, narrativa cerrada,
  tutorial omitido, red vial `ready`, ruta `road`, touch CDP real, objetivo
  58 km/h, 10 s de warm-up y 30 s de observación.
- Baseline y final: tres repeticiones limpias por candidato. El capturador
  rechazó worktree sucio, SHA de build distinto al repositorio y ruta fallback.
- Diagnostics y profiling de producción: desactivados.
- Esto no es una medición de teléfono físico.

Artefactos locales del runtime final:
`artifacts/performance-schema4/head-1a8de10/run1..3`.

## Resultado de frame pacing

| Métrica                  | Base mediana | Final mediana |    Final min–max |  Cambio |
| ------------------------ | -----------: | ------------: | ---------------: | ------: |
| FPS throughput           |       51.607 |        50.746 |    50.341–51.007 |  -1.67% |
| FPS instantáneo promedio |       55.123 |        54.526 |    54.243–54.713 |  -1.08% |
| Frametime promedio       |    19.377 ms |     19.706 ms | 19.605–19.865 ms |  +1.70% |
| Frametime p50            |      16.7 ms |       16.7 ms |     16.7–16.7 ms |      0% |
| Frametime p95            |      33.4 ms |       33.4 ms |     33.4–33.4 ms |      0% |
| Frametime p99            |      33.4 ms |       33.4 ms |     33.4–33.4 ms |      0% |
| Frames >33 ms            |          252 |           278 |          270–290 | +10.32% |
| Frames >50 ms            |            0 |             0 |              0–0 |       0 |
| Frames >100 ms           |            0 |             0 |              0–0 |       0 |
| Long tasks               |            0 |             0 |              0–0 |       0 |

Los gates críticos se conservan: p95/p99 no empeoran, no aparecen frames

> 50 ms o >100 ms y no hay long tasks. Sin embargo, throughput, frametime medio
> y frames apenas mayores de 33 ms todavía empeoran frente a la base. No se
> declara una mejora global de frame pacing; la diferencia debe revisarse en
> teléfonos físicos.

## Costes del runtime

| Métrica                 | Base mediana | Final mediana |     Final min–max |     Cambio |
| ----------------------- | -----------: | ------------: | ----------------: | ---------: |
| Cámara promedio         |     2.149 ms |      1.318 ms |    1.307–1.352 ms |    -38.67% |
| Cámara p95              |       3.0 ms |        1.7 ms |        1.7–1.8 ms |    -43.33% |
| Cámara aplicada         |     28.733/s |      30.367/s |   30.300–30.400/s |     +5.69% |
| RoadTracker p95         |       0.2 ms |        0.1 ms |        0.1–0.1 ms |    -50.00% |
| GeoJSON / 30 s          |          107 |           109 |           107–111 |     +1.87% |
| Three jugador / 30 s    |         1564 |          1542 |         1531–1544 |     -1.41% |
| MobileDrivingHud / 30 s |          151 |           150 |           150–150 |     -0.66% |
| Heap final expuesto     |   54.169 MiB |    54.169 MiB | 42.629–64.850 MiB | 0% mediana |
| Área útil de mapa       |          n/d |         75.9% |        75.9–75.9% |        n/d |

La cámara cumple p95 <3 ms. No hubo `queryRenderedFeatures` con diagnostics
apagado. Los tres arquetipos comparten un único GLB local provisional y no se
cargan tres modelos. El heap está cuantizado y su rango no permite inferir una
mejora de memoria.

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
segura detener → soltar → segundo gesto para reversa. Las tres capturas de
rendimiento midieron touch → almacenado en 49.5 ms (46.0–51.3), touch →
consumo en 52.1 ms (48.4–54.1) y selección del objetivo 58 km/h en 762 ms
(756–790).

Un primer intento de la tanda 10× fue inválido: el preview había terminado por
su límite de una hora y los diez casos fallaron en `page.goto` con
`ERR_CONNECTION_REFUSED` antes de abrir el juego. Se verificó la causa, se
reinició el mismo build y la tanda válida pasó 10/10 sin retries. Este incidente
no se cuenta como fallo de gameplay ni se oculta.

## Primeros cinco minutos

Tres sesiones completas de 300 s se capturaron sobre
`1a8de1021b4547bb848ea4626a873f3876dcd129`:

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
Zustand, GPU, repaints MapLibre, batería, temperatura, audio real, haptics y
diversión: n/d. El timer headless muestra cuantización alrededor de
16.7/33.4 ms. Heap es una lectura de Chromium, no memoria total del proceso o
GPU. Ninguna cifra demuestra diversión, comodidad, ausencia de mareo o
sostenibilidad térmica.

# Arcade Core v0.3.0 — resultado optimizado

## Identidad y método

- Fecha: 2026-07-17.
- Base: `607a12d6de95359ae95235e7e4034fe7287705a3`.
- Candidato de runtime medido: `9677ff8a213ca9edc7ab18d506307720ea44f750`.
- Entorno: Windows, Node `v24.18.0`, npm `11.16.0`, Chromium
  `149.0.7827.55` headless, Pixel 7, viewport `392×850`, DPR 2.
- Contrato schema 4: almacenamiento limpio, partida nueva, narrativa cerrada,
  tutorial omitido, red vial `ready`, ruta `road`, touch CDP real, objetivo
  58 km/h, 10 s de warm-up y 30 s de observación.
- Baseline y final: tres repeticiones limpias por candidato. El comparador
  rechaza SHA de build distinto al repositorio, worktree sucio y ruta fallback.
- Diagnostics y profiling de producción: desactivados.
- El commit documental de cierre es posterior al candidato medido y no cambia
  el runtime. Build, Docker y CI se validan aparte sobre el SHA final exacto.
- Esto no es una medición de teléfono físico.

## Resultado de frame pacing

| Métrica | Base mediana | Final mediana | Final min–max | Cambio |
|---|---:|---:|---:|---:|
| FPS throughput | 51.607 | 48.142 | 46.643–49.841 | -6.71% |
| FPS instantáneo promedio | 55.123 | 52.613 | 51.414–53.885 | -4.55% |
| Frametime promedio | 19.377 ms | 20.772 ms | 20.064–21.440 ms | +7.20% |
| Frametime p50 | 16.7 ms | 16.7 ms | 16.7–16.7 ms | 0% |
| Frametime p95 | 33.4 ms | 33.4 ms | 33.4–33.4 ms | 0% |
| Frametime p99 | 33.4 ms | 33.4 ms | 33.4–33.4 ms | 0% |
| Frames >33 ms | 252 | 356 | 305–401 | +41.27% |
| Frames >50 ms | 0 | 0 | 0–0 | 0 |
| Frames >100 ms | 0 | 0 | 0–0 | 0 |
| Long tasks | 0 | 0 | 0–0 | 0 |

Los gates críticos se conservan: p95/p99 no empeoran, no aparecen frames
>50 ms o >100 ms y no hay long tasks. Sin embargo, throughput, frametime medio
y frames apenas mayores de 33 ms empeoran. Por tanto, no se declara una mejora
global de frame pacing; el bloque queda técnicamente estable para playtest y
esta diferencia debe investigarse en teléfonos físicos.

## Costes del runtime

| Métrica | Base mediana | Final mediana | Final min–max |
|---|---:|---:|---:|
| Cámara promedio | 2.149 ms | 1.409 ms | 1.347–1.477 ms |
| Cámara p95 | 3.0 ms | 2.0 ms | 1.8–2.1 ms |
| Cámara aplicada | 28.733/s | 30.300/s | 30.200–30.367/s |
| RoadTracker p95 | 0.2 ms | 0.1 ms | 0.1–0.2 ms |
| GeoJSON / 30 s | 107 | 110 | 107–113 |
| Three jugador / 30 s | 1564 | 1457 | 1414–1509 |
| MobileDrivingHud / 30 s | 151 | 150 | 150–152 |
| Heap final expuesto | 54.169 MiB | 54.169 MiB | 48.065–68.855 MiB |
| Área útil de mapa | n/d | 75.9% | 75.9–75.9% |

La cámara cumple p95 <3 ms y reduce su coste mediano. No hubo
`queryRenderedFeatures` con diagnostics apagado. Los tres arquetipos comparten
un único GLB local provisional; el E2E verifica que no se cargan tres modelos.
El heap está cuantizado y su rango no permite inferir una mejora de memoria.

## Movimiento inmediato

Cinco repeticiones con telemetría detallada se ejecutaron sobre un candidato
funcional anterior del mismo bloque de controles. Los cambios posteriores no
alteraron la física ni el input; la suite final vuelve a validar el contrato,
pero estas duraciones no se presentan como una medición exacta del SHA de
cierre.

| Métrica | Mediana | Mínimo | Máximo | Criterio |
|---|---:|---:|---:|---:|
| Evento touch → input almacenado | 58.3 ms | 56.2 | 59.9 | observación |
| Evento touch → input consumido | 60.6 ms | 57.9 | 62.2 | observación |
| Consumo → primera posición | 0.2 ms | 0.2 | 0.3 | <250 ms |
| Evento → primer frame visual | 48.4 ms | 40.9 | 56.4 | <1 s |
| Movimiento visible total | 269 ms | 265 | 291 | <1 s |
| 10 km/h | 565 ms | 557 | 585 | <1 s |
| 20 km/h | 849 ms | 768 | 892 | <2 s |
| 30 km/h | 1123 ms | 1073 | 1187 | <3 s |

En las tres capturas finales estrictas, touch → input almacenado tuvo mediana
47.7 ms (46.4–52.7), touch → consumo 50.3 ms (49.0–58.1) y seleccionar el
objetivo de 58 km/h 719 ms (704–763).

## Primeros cinco minutos

Tres sesiones completas de 300 s se capturaron sobre
`9677ff8a213ca9edc7ab18d506307720ea44f750`:

- 3/3 terminaron con red vial `ready`, ruta `road`, cero overlays y Torogoz.
- 0 ms inmóvil y cero recuperaciones registradas en las tres sesiones.
- 11 capturas por sesión: 0, 1, 3, 8, 15, 30, 45, 75, 120, 180 y 300 s.
- Primer evento/recompensa: mediana 2148 ms, rango 2102–2159 ms.
- Área útil al cierre: mediana 72.0%, rango 72.0–81.2%.
- El evento de radio entrega la primera recompensa durable; el runner no
  completa objetivos ni asigna recompensas mediante el store.
- Artefactos locales: `artifacts/five-minutes/schema4-9677/` y
  `artifacts/performance-schema4/`.

Tiempo preciso de carga del modelo y de cambio de vehículo: n/d. Escrituras
Zustand, GPU, repaints MapLibre, batería, temperatura, audio real, haptics y
diversión: n/d.

## Límites

El timer headless muestra cuantización alrededor de 16.7/33.4 ms. Heap es una
lectura de Chromium, no memoria total del proceso/GPU. Ninguna cifra demuestra
diversión, comodidad, ausencia de mareo o sostenibilidad térmica.

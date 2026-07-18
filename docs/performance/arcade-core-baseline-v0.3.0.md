# Arcade Core v0.3.0 — baseline

## Identidad

- Fecha de auditoría inicial: 2026-07-17.
- SHA base real: `607a12d6de95359ae95235e7e4034fe7287705a3`.
- Versión heredada: `0.2.5.3`.
- Worktree inicial: limpio; `main` se actualizó por fast-forward.
- Entorno: Windows, Node `v24.18.0`, npm `11.16.0`, Chromium
  `149.0.7827.55` headless, Pixel 7, `392×850`, DPR 2.
- El build histórico se reconstruyó desde un worktree limpio y el capturador
  verificó que el SHA servido coincidía con el SHA base.
- Estos datos no representan un teléfono físico.

## Auditoría funcional inicial

- Unitarias: 403 aprobadas, 0 fallidas, 0 omitidas, 77 archivos.
- E2E: 57 aprobadas, 0 fallidas, 44 omitidas por proyecto/matriz.
- Lint, typecheck, build y `npm run check`: aprobados.
- PMTiles: 64.38 MiB; Range Request `206`, 1024 bytes.
- Red vial: 17 083 nodos, 23 054 aristas, 6.02 MiB.
- Objetivos: 20 válidos y 1 excepción offroad explícita.
- GLB, manifest, service worker, CSP y `/healthz`: HTTP 200.
- Docker base: build y ejecución local aprobados.
- `npm ci` falló inicialmente porque un Vite previo retenía Rolldown; al
  detenerlo, la instalación limpia pasó sin vulnerabilidades.

## Método comparable final

Se conservaron dos escenarios reproducibles sobre el mismo SHA base. Cada uno
tuvo tres corridas, 10 segundos de calentamiento y 30 segundos de observación.
Ambos usan save/settings deterministas, red vial `ready`, ruta `idle`, control
`target-speed-joystick`, semilla fija, checkpoint sobre la troncal `10999`,
heading `244.8°` y touch CDP real. Diagnostics y profiling de producción
permanecieron apagados.

El comparador schema 5 rechaza diferencias materiales de duración, velocidad,
objetivo, distancia, trayectoria, heading, superficie, edge o modo de ruta.
Las seis capturas base conservaron 100% de superficie `trunk`, edge `10999`,
ruta `idle` y heading `244.8°`.

Artefactos:

- `artifacts/performance-fast-64b9906/baseline/run-1..3`
- `artifacts/performance-cruise-64b9906/baseline/run-1..3`

## Baseline de alta velocidad

Velocidad media por corrida: 91.313–91.415 km/h; objetivo medio: 90 km/h.

| Métrica                  |   Mediana |    Rango min–max |
| ------------------------ | --------: | ---------------: |
| FPS throughput           |    53.639 |    52.973–55.236 |
| FPS instantáneo promedio |    56.444 |    56.020–57.413 |
| Frametime promedio       | 18.643 ms | 18.104–18.878 ms |
| Frametime p50            |   16.7 ms |     16.7–16.7 ms |
| Frametime p95            |   33.3 ms |     33.3–33.3 ms |
| Frametime p99            |   33.4 ms |     33.4–33.4 ms |
| Frames >33 ms            |       191 |          143–211 |
| Frames >50 ms            |         0 |              0–0 |
| Frames >100 ms           |         0 |              0–0 |
| Long tasks               |         0 |              0–0 |
| Cámara promedio          |  2.947 ms |   2.104–3.357 ms |
| Cámara p95               |    5.4 ms |       3.0–6.1 ms |
| RoadTracker p95          |    0.1 ms |       0.1–0.1 ms |
| GeoJSON / 30 s           |         0 |              0–0 |

## Baseline de crucero contemporáneo

Velocidad media por corrida: 63.167–63.639 km/h; objetivo medio:
61.8–62.3 km/h.

| Métrica                  |   Mediana |    Rango min–max |
| ------------------------ | --------: | ---------------: |
| FPS throughput           |    57.770 |    53.873–58.437 |
| FPS instantáneo promedio |    58.844 |    56.590–59.199 |
| Frametime promedio       | 17.310 ms | 17.113–18.562 ms |
| Frametime p50            |   16.7 ms |     16.7–16.7 ms |
| Frametime p95            |   16.8 ms |     16.8–33.3 ms |
| Frametime p99            |   33.4 ms |     33.3–33.4 ms |
| Frames >33 ms            |        67 |           47–184 |
| Frames >50 ms            |         0 |              0–0 |
| Frames >100 ms           |         0 |              0–0 |
| Long tasks               |         0 |              0–0 |
| Cámara promedio          |  2.271 ms |   2.131–3.157 ms |
| Cámara p95               |    3.3 ms |       3.0–6.5 ms |
| RoadTracker p95          |    0.1 ms |       0.1–0.1 ms |
| GeoJSON / 30 s           |         0 |              0–0 |

## Movimiento y experiencia en la base

| Métrica                                  |                    Baseline |
| ---------------------------------------- | --------------------------: |
| Touch → input almacenado                 |                         n/d |
| Touch → input consumido                  |                         n/d |
| Consumo → primera posición               |                         n/d |
| Consumo → primer frame visual            |                         n/d |
| 0 → 10 km/h                              |   ~0.31 s, simulación ideal |
| 0 → 20 km/h                              |   ~0.62 s, simulación ideal |
| 0 → 30 km/h                              |   ~0.93 s, simulación ideal |
| Tiempo inmóvil en los primeros 60 s      |                         n/d |
| Primer evento / recompensa               |                         n/d |
| Ayudas / recuperaciones / falsos offroad |                         n/d |
| Vehículo fuera del viewport seguro       | n/d; el concepto no existía |
| Área útil de mapa                        |                         n/d |

Los tiempos de velocidad son una derivación física ideal, no una medición visual
ni de input. No demuestran respuesta en teléfono.

## Problemas iniciales priorizados

1. Inicio ejecutable sin una intención de movimiento clara y tutorial capaz de
   pedir giro detenido.
2. Penalización offroad universal de 25%, sin gracia ni reincorporación.
3. Navegación confundible con el vehículo y cámara calculada sobre el canvas
   completo.

Los costes técnicos principales eran cámara/MapLibre/Three y fanout de UI. El
RoadTracker no era cuello de botella según las capturas comparables.

## No disponible

Latencia base al primer píxel, coste GPU/Three, repaints MapLibre, escrituras
Zustand, coste individual de `setData`, eventos GC, memoria GPU, temperatura,
batería, hápticos, sonido, mareo, fatiga, legibilidad al sol y diversión.

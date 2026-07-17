# Arcade Core v0.3.0 — baseline

## Identidad

- Fecha: 2026-07-17.
- SHA base: `607a12d6de95359ae95235e7e4034fe7287705a3`.
- Versión heredada: `0.2.5.3`.
- Entorno: Windows, Node `v24.18.0`, npm `11.16.0`, Chromium
  headless, viewport `392×850`, DPR 2.
- Este resultado no representa un teléfono físico.

## Auditoría funcional

- Worktree inicial: limpio; `main` actualizado por fast-forward.
- Unitarias: 403 aprobadas, 0 fallidas, 0 omitidas, 77 archivos.
- E2E: 57 aprobadas, 0 fallidas, 44 omitidas.
- Lint, typecheck, build y `npm run check`: aprobados.
- PMTiles: 64.38 MiB; Range Request `206`, 1024 bytes.
- Red vial: 17 083 nodos, 23 054 aristas, 6.02 MiB.
- Objetivos: 20 válidos; 1 excepción offroad explícita.
- GLB actual, manifest, service worker, CSP y `/healthz`: HTTP 200.
- Docker base: build y ejecución local aprobados.
- `npm ci` falló inicialmente por un Vite previo que retenía Rolldown; tras
  detener ese proceso, la instalación limpia pasó sin vulnerabilidades.

## Escenario de rendimiento

Partida nueva con almacenamiento limpio, narrativa cerrada, tutorial omitido,
red vial lista y gesto táctil CDP real hasta un objetivo de 58 km/h. Se usaron
10 segundos de calentamiento y 30 segundos de conducción con diagnostics y
profiling de producción desactivados. Solo existe una corrida comparable en
este punto; las cifras son baseline inicial, no una distribución.

| Métrica | Baseline |
|---|---:|
| FPS throughput | 55.138 |
| FPS instantáneo promedio | 57.356 |
| FPS instantáneo mediano | 59.880 |
| Frametime promedio | 18.136 ms |
| Frametime p50 | 16.7 ms |
| Frametime p95 | 33.3 ms |
| Frametime p99 | 33.4 ms |
| Frametime máximo | 33.5 ms |
| Frames >33 ms | 146/1655 (8.82%) |
| Frames >50 ms | 0 |
| Frames >100 ms | 0 |
| Long tasks | 0 |
| Cámara solicitada | 55.63/s |
| Cámara aplicada | 29.13/s |
| Cámara promedio | 2.023 ms |
| Cámara p95 | 2.8 ms |
| RoadTracker promedio | 0.040 ms |
| RoadTracker p95 | 0.1 ms |
| GeoJSON | 112 actualizaciones (3.73/s) |
| Three.js jugador | 1669 actualizaciones (55.63/s) |
| MobileDrivingHud | 150 renders (5/s) |
| Heap expuesto | 61.035 MiB inicial/final, cuantizado |

## Movimiento y experiencia

| Métrica | Baseline |
|---|---:|
| Touch → input almacenado | n/d en build normal |
| Input almacenado → consumo | n/d en build normal |
| Consumo → primera posición | n/d |
| Consumo → primer frame visual | n/d |
| 0 → 10 km/h | ~0.31 s, simulación ideal |
| 0 → 20 km/h | ~0.62 s, simulación ideal |
| 0 → 30 km/h | ~0.93 s, simulación ideal |
| Seleccionar objetivo de 58 km/h | 1126 ms en el escenario medido |
| Tiempo inmóvil primeros 60 s | n/d |
| Primer evento / recompensa | n/d |
| Ayudas / recuperaciones / falsos offroad | n/d |
| Vehículo fuera del viewport seguro | n/d; el concepto aún no existe |
| Área HUD | pruebas geométricas existentes exigen ≥58% de mapa |

Los tiempos a 10/20/30 km/h son una derivación física ideal, no una medición
visual. No demuestran respuesta en un teléfono.

## Ranking inicial

1. Startup ejecutable sin controles, tutorial que pide girar detenido y gate de
   simulación fragmentado.
2. Offroad confirmado con límite universal de 25%, sin ayuda de reincorporación.
3. Fallback cian parecido a la ruta y cámara calculada sobre el canvas completo.

Los principales costes técnicos medidos son la cadena cámara/MapLibre/Three,
las actualizaciones Three por RAF y el fanout GeoJSON/Zustand/audio. RoadTracker
no es candidato de optimización con este baseline.

## No disponible

Latencia al primer píxel, duración Three/GPU, repaints MapLibre, escrituras
Zustand, coste individual de `setData`, eventos GC, memoria GPU, SW durante la
conducción, temperatura, batería, hápticos, sonido, mareo, fatiga, claridad al
sol y diversión requieren instrumentación adicional o teléfono físico.

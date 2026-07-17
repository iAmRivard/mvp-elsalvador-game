# Arcade Core v0.3.0 — baseline

## Identidad

- Fecha: 2026-07-17.
- SHA base: `607a12d6de95359ae95235e7e4034fe7287705a3`.
- Versión heredada: `0.2.5.3`.
- Entorno: Windows, Node `v24.18.0`, npm `11.16.0`, Chromium
  `149.0.7827.55` headless, Pixel 7, viewport `392×850`, DPR 2.
- Build histórico reconstruido desde un worktree limpio. La captura verificó
  que el SHA servido y el SHA del repositorio eran exactamente el SHA base.
- Este resultado no representa un teléfono físico.

## Auditoría funcional inicial

- Worktree inicial limpio; `main` se actualizó por fast-forward.
- Unitarias: 403 aprobadas, 0 fallidas, 0 omitidas, 77 archivos.
- E2E: 57 aprobadas, 0 fallidas, 44 omitidas.
- Lint, typecheck, build y `npm run check`: aprobados.
- PMTiles: 64.38 MiB; Range Request `206`, 1024 bytes.
- Red vial: 17 083 nodos, 23 054 aristas, 6.02 MiB.
- Objetivos: 20 válidos; 1 excepción offroad explícita.
- GLB, manifest, service worker, CSP y `/healthz`: HTTP 200.
- Docker base: build y ejecución local aprobados.
- `npm ci` falló inicialmente porque un Vite previo retenía Rolldown; después
  de detenerlo, la instalación limpia pasó sin vulnerabilidades.

## Escenario de rendimiento comparable

Tres corridas con almacenamiento limpio, partida nueva, narrativa cerrada,
tutorial omitido, red vial `ready`, ruta `road` y gesto táctil CDP real hasta
58 km/h. Cada corrida usó 10 segundos de calentamiento y 30 segundos de
observación con diagnostics y profiling de producción desactivados.

| Métrica | Mediana | Rango min–max |
|---|---:|---:|
| FPS throughput | 51.607 | 51.073–51.702 |
| FPS instantáneo promedio | 55.123 | 54.757–55.185 |
| Frametime promedio | 19.377 ms | 19.342–19.580 ms |
| Frametime p50 | 16.7 ms | 16.7–16.7 ms |
| Frametime p95 | 33.4 ms | 33.4–33.4 ms |
| Frametime p99 | 33.4 ms | 33.4–33.4 ms |
| Frames >33 ms | 252 | 249–268 |
| Frames >50 ms | 0 | 0–0 |
| Frames >100 ms | 0 | 0–0 |
| Long tasks | 0 | 0–0 |
| Cámara aplicada | 28.733/s | 28.633–28.733/s |
| Cámara promedio | 2.149 ms | 2.147–2.176 ms |
| Cámara p95 | 3.0 ms | 2.9–3.1 ms |
| RoadTracker p95 | 0.2 ms | 0.1–0.2 ms |
| GeoJSON / 30 s | 107 | 100–111 |
| Three.js jugador / 30 s | 1564 | 1545–1568 |
| MobileDrivingHud / 30 s | 151 | 150–153 |
| Heap final expuesto | 54.169 MiB | 42.629–61.035 MiB |
| Selección de objetivo 58 km/h | 1195 ms | 1133–1198 ms |

## Movimiento y experiencia

| Métrica | Baseline |
|---|---:|
| Touch → input almacenado | n/d en build base |
| Input almacenado → consumo | n/d en build base |
| Consumo → primera posición | n/d |
| Consumo → primer frame visual | n/d |
| 0 → 10 km/h | ~0.31 s, simulación ideal |
| 0 → 20 km/h | ~0.62 s, simulación ideal |
| 0 → 30 km/h | ~0.93 s, simulación ideal |
| Tiempo inmóvil primeros 60 s | n/d |
| Primer evento / recompensa | n/d |
| Ayudas / recuperaciones / falsos offroad | n/d |
| Vehículo fuera del viewport seguro | n/d; el concepto aún no existía |
| Área útil de mapa | n/d en el capturador base |

Los tiempos a 10/20/30 km/h son una derivación física ideal, no una medición
visual. No demuestran respuesta en un teléfono.

## Ranking inicial

1. Inicio ejecutable sin controles, tutorial que pedía girar detenido y gates
   de simulación fragmentados.
2. Offroad confirmado con límite universal de 25%, sin reincorporación.
3. Navegación visualmente confundible con el vehículo y cámara calculada sobre
   el canvas completo.

Los principales costes técnicos observados eran cámara/MapLibre/Three, las
actualizaciones Three por RAF y el fanout GeoJSON/Zustand/audio. RoadTracker no
era candidato prioritario según este baseline.

## No disponible

Latencia al primer píxel, duración GPU/Three, repaints MapLibre, escrituras
Zustand, coste individual de `setData`, eventos GC, memoria GPU, temperatura,
batería, hápticos, sonido, mareo, fatiga, claridad al sol y diversión requieren
instrumentación adicional o teléfono físico.

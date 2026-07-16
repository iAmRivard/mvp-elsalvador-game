# Baseline móvil v0.2.5.1

Fecha: 15 de julio de 2026. Código base: `a9018ad409cce01e0e4ec51afec0540ebbbf36a1`.

## Protocolo

- Build de producción servido con Vite Preview en Windows.
- Chromium headless con emulación Pixel 7 (viewport interior 412×839).
- Partida nueva, inicio de **La transmisión**, joystick de velocidad objetivo y conducción continua.
- 10 s de calentamiento y 30 s de observación.
- Captura con `npm run capture:driving-ux -- <url> <directorio>`.

La captura inicial anterior sólo observaba el último segundo y no era comparable. Este baseline se
repitió desde el commit base con la ventana completa antes de optimizar.

## Resultado

| Métrica | Baseline |
| --- | ---: |
| FPS promedio / mediana | 53.98 / 59.88 |
| Frametime promedio | 20.013 ms |
| Frametime p95 / p99 | 33.4 / 33.4 ms |
| Frames >33 / >50 / >100 ms | 301 / 0 / 0 |
| Cámara promedio / p95 | 0.899 / 1.1 ms |
| RoadTracker promedio / p95 | 0.060 / 0.1 ms |
| Renders de `MobileDrivingHud` | 152 |
| Ticks de telemetría | 285 |
| `queryRenderedFeatures` de diagnóstico | 30 |
| Long tasks | 0 |
| Respuesta de entrada observada | 1,188 ms |
| Heap final expuesto por Chromium | 54.17 MiB |

El contador de actualizaciones GeoJSON se incorporó durante la corrección, por lo que no existe un
valor base comparable. El heap de `performance.memory` en headless es orientativo y no sustituye
un perfil de memoria en el teléfono físico.

## Lectura

El p95 cae en el escalón de 33.4 ms del compositor headless aunque no hubo frames >50 ms ni tareas
largas. Los candidatos medibles fueron las consultas diagnósticas de capas, actualizaciones
redundantes del store, serialización de autosave, mutaciones de cámara y llamadas `setData`.

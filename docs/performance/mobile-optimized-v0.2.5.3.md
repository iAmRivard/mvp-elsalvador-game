# Optimización móvil v0.2.5.3

Fecha: 16 de julio de 2026.

- SHA base: `787066658fed9907bfc74c23f18d05cb09cfae7f`.
- SHA candidato de runtime medido:
  `ee08f644680c24db4f207cb93aa6fd85488c2d96`.
- Corridas: tres secuenciales sobre el mismo SHA y build.
- Entorno: producción normal, Vite Preview, Windows, Chromium headless y Pixel
  7 emulado con viewport interior 412×839.
- Protocolo: mismo recorrido del baseline, 10 segundos de calentamiento y 30
  segundos de observación.

El SHA candidato contiene todos los cambios de producción y el cache PWA
v0.2.5.3. El capturador registra el SHA dentro de cada JSON. Después de cerrar
documentación se ejecuta una verificación final de tres corridas sobre el HEAD
publicable exacto; ese SHA y sus resultados se transcriben en el informe del PR
sin atribuirlos a una prueba física.

## Comparación estricta

| Métrica                           | Base v0.2.5.2 | Candidato v0.2.5.3 |      Cambio |
| --------------------------------- | ------------: | -----------------: | ----------: |
| FPS por throughput                |        51.079 |             53.202 |       +4.2% |
| FPS instantáneo promedio          |        54.761 |             56.165 |       +2.6% |
| FPS instantáneo mediano           |        59.880 |             59.880 |          0% |
| Frametime promedio                |     19.578 ms |          18.796 ms |       -4.0% |
| Frametime p50                     |       16.7 ms |            16.7 ms |          0% |
| Frametime p95                     |       33.4 ms |            33.3 ms |     -0.1 ms |
| Frametime p99                     |       33.4 ms |            33.4 ms |          0% |
| Frames >33 ms                     |           268 |                204 |      -23.9% |
| Frames >50 ms                     |             0 |                  0 | sin aumento |
| Frames >100 ms                    |             0 |                  0 | sin aumento |
| Long tasks                        |             0 |                  0 | sin aumento |
| Cámara solicitada/s               |          51.6 |             53.667 |       +4.0% |
| Cámara aplicada/s                 |        28.633 |             28.833 |       +0.7% |
| Cámara omitida por intervalo      |           689 |                745 |       +8.1% |
| Cámara omitida por tolerancia     |             0 |                  0 |           0 |
| Cámara promedio                   |      1.343 ms |           1.953 ms |   +0.610 ms |
| Cámara p95                        |        1.8 ms |             2.5 ms |     +0.7 ms |
| RoadTracker promedio              |      0.052 ms |           0.055 ms |   +0.003 ms |
| RoadTracker p95                   |        0.1 ms |             0.1 ms |           0 |
| Actualizaciones GeoJSON           |           111 |                111 |           0 |
| Renders `MobileDrivingHud`        |           151 |                150 |          -1 |
| Heap final expuesto               |    54.169 MiB |         64.850 MiB |    variable |
| Selección del objetivo de 58 km/h |      1,194 ms |           1,136 ms |       -4.9% |
| Evento → almacenado/consumido/RAF |           n/d |                n/d |         n/d |
| Latencia visual real              |           n/d |                n/d |         n/d |

Rangos del candidato:

- FPS throughput: 51.179–53.706.
- FPS instantáneo promedio: 54.831–56.485.
- Frametime promedio: 18.620–19.539 ms.
- Frames >33 ms: 189–265.
- Cámara solicitada: 50.2–54.167/s.
- Cámara aplicada: 27.7–29.033/s.
- Cámara promedio: 1.934–1.985 ms.
- Cámara p95: 2.5–2.6 ms.
- RoadTracker promedio: 0.047–0.056 ms; p95 0.1 ms.
- GeoJSON: 95–113.
- Heap final: 48.065–73.051 MiB.
- Selección de 58 km/h: 1,115–1,196 ms.
- Ninguna corrida produjo frames >50 ms, frames >100 ms o long tasks.

El costo de cámara aumenta porque ahora realiza la transformación geográfica
que coloca realmente al jugador en el offset solicitado. Aun así, promedio y
p95 permanecen por debajo de 3 ms en las tres corridas. El p95 de frametime
queda cuantizado alrededor de 33.3 ms: no se alcanzó la meta de reducción del
25%, aunque los frames >33 ms bajaron 23.9% y no aumentaron los frames >50 ms.

## Cambios medidos

- `OverlayManager` controla `expanded`/`compact`; compacta deja libre el slot
  grande y permite consejos, mientras expandir vuelve a solicitarlo.
- Una función pura produce opciones enviadas, estado aplicado y motivo de
  omisión. El offset se aplica en seguimiento, cambio de perfil, resize,
  restauración y recenter sin acumulación.
- El marcador fallback no se actualiza mientras Three.js está listo y se
  sincroniza con la última posición antes de reaparecer.
- Los efectos Three.js reciben un booleano y sólo se actualizan al cambiar
  `offroad`.
- El capturador final registra deltas de offset, perfiles, fallback, jugador
  Three.js y efectos. El candidato previo sólo tenía contadores acumulados, por
  lo que esos deltas se dejan como `n/d` aquí y se informan desde las corridas
  exactas finales.
- Los errores del mapa usan severidad `fatal`, `degraded` u `optional` con URL,
  fuente y tipo estructurados. PMTiles principal y WebGL limpian input; red vial
  degrada; sprite/modelo/audio identificados no desmontan el juego.

## Límites

La automatización no confirma fluidez percibida. Sigue pendiente un teléfono
físico para recorrido corto, sesión de 15 minutos, temperatura, barra del
navegador, GPU, audio, hápticos, safe areas, reversa, Turbo, bitácora y
objetivos. El próximo RAF no equivaldría a presentación visual, por lo que no se
publica como latencia real.

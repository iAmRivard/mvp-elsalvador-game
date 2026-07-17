# Baseline móvil v0.2.5.3

Fecha: 16 de julio de 2026.

- SHA base exacto: `787066658fed9907bfc74c23f18d05cb09cfae7f`.
- Rama base: `main`, merge de v0.2.5.2.
- Build: producción normal servido con Vite Preview en Windows.
- Navegador: Chromium headless con emulación Pixel 7.
- Viewport interior observado: 412×839.
- Escenario: partida nueva, **La transmisión**, tutorial omitido y objetivo de
  velocidad de al menos 58 km/h.
- Protocolo: 10 segundos de calentamiento y 30 segundos de observación.
- Corridas: tres, secuenciales y sobre el mismo SHA.

Los valores centrales son medianas; el rango mínimo–máximo aparece entre
paréntesis.

| Métrica                             |       Mediana base (rango) |
| ----------------------------------- | -------------------------: |
| FPS por throughput                  |     51.079 (50.641–51.240) |
| FPS instantáneo promedio            |     54.761 (54.455–54.868) |
| FPS instantáneo mediano             |                     59.880 |
| Frametime promedio                  |  19.578 ms (19.516–19.747) |
| Frametime p50                       |                    16.7 ms |
| Frametime p95                       |                    33.4 ms |
| Frametime p99                       |                    33.4 ms |
| Frames >33 ms                       |              268 (263–281) |
| Frames >50 ms                       |                          0 |
| Frames >100 ms                      |                          0 |
| Long tasks                          |                          0 |
| Cámara solicitada/s                 |           51.6 (51.2–51.8) |
| Cámara aplicada/s                   |     28.633 (28.633–28.767) |
| Cámara omitida por intervalo        |              689 (677–691) |
| Cámara omitida por tolerancia       |                          0 |
| Cámara promedio                     |     1.343 ms (1.338–1.516) |
| Cámara p95                          |           1.8 ms (1.8–2.3) |
| RoadTracker promedio                |     0.052 ms (0.048–0.055) |
| RoadTracker p95                     |           0.1 ms (0.1–0.2) |
| Actualizaciones GeoJSON             |              111 (110–113) |
| Renders `MobileDrivingHud`          |              151 (150–152) |
| Heap final expuesto                 | 54.169 MiB (48.065–57.507) |
| Selección del objetivo de 58 km/h   |     1,194 ms (1,129–1,209) |
| Aplicaciones reales de offset       |                        n/d |
| Actualizaciones del fallback oculto |                        n/d |
| Actualizaciones Three.js            |                        n/d |
| Actualizaciones de efectos Three.js |                        n/d |
| Evento → almacenado                 |                        n/d |
| Evento → consumido                  |                        n/d |
| Evento → próximo RAF                |                        n/d |
| Latencia visual real                |                        n/d |

## Costos principales confirmados

1. El seguimiento calculaba offsets, pero `jumpTo()` normal no los aplicaba y el
   estado lógico los registraba como si hubieran llegado al mapa.
2. El marcador DOM de respaldo seguía recibiendo posición/rotación aunque
   Three.js ya lo hubiera ocultado.
3. `setDrivingEffects` recibía trabajo por frame aunque `offroad` no cambiara.

La radio compacta no es un costo de frame, pero mantenía el candidato grande
activo y bloqueaba consejos contextuales después de contraerse visualmente.

## Límites

Estos resultados provienen de Chromium headless, no de un teléfono físico. No
validan fluidez subjetiva, barra del navegador, temperatura, throttling,
batería, GPU física, audio, hápticos ni safe areas reales. El heap expuesto por
Chromium es variable y no se interpreta por sí solo como fuga o regresión.

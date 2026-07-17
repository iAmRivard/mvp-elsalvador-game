# Arcade Core v0.3.0 - resultado optimizado

## Identidad y metodo

- Fecha: 2026-07-17.
- Base: `607a12d6de95359ae95235e7e4034fe7287705a3`.
- Candidato de runtime medido: `59896382b0fbf5f531951907ed19890f6bc9b543`.
- Entorno: Windows, Node 24.18.0, npm 11.16.0, Chromium headless,
  dispositivo Pixel 7. El viewport interior reportado fue 412x839; las pruebas
  funcionales de movimiento usaron 392x850.
- Escenario comparable: almacenamiento limpio, partida nueva, narrativa
  cerrada, tutorial omitido, gesto touch CDP real, 10 s de warm-up y 30 s de
  conduccion.
- Repeticiones de rendimiento: 3. Se muestran mediana y rango min-max.
- Diagnostics y profiling de produccion: desactivados.
- Esto no es una medicion de telefono fisico.

## Resultado de frame pacing

| Metrica                  |  Baseline | Final mediana |    Final min-max |
| ------------------------ | --------: | ------------: | ---------------: |
| FPS throughput           |    55.138 |        51.740 |    50.669-51.807 |
| FPS instantaneo promedio |    57.356 |        55.213 |    54.476-55.256 |
| Frametime promedio       | 18.136 ms |     19.327 ms | 19.303-19.736 ms |
| Frametime p50            |   16.7 ms |       16.7 ms |     16.7-16.7 ms |
| Frametime p95            |   33.3 ms |       33.4 ms |     33.4-33.4 ms |
| Frametime p99            |   33.4 ms |       33.4 ms |     33.4-33.4 ms |
| Frames >33 ms            |       146 |           248 |          246-280 |
| Frames >50 ms            |         0 |             0 |              0-0 |
| Frames >100 ms           |         0 |             0 |              0-0 |
| Long tasks               |         0 |             0 |              0-0 |

El p95 queda en el mismo escalon cuantizado de 33.3/33.4 ms y no aparecen
frames >50 ms ni >100 ms. El throughput y los frames apenas por encima de 33 ms
son peores que la unica corrida baseline; no se oculta esa diferencia. Por
ello el resultado permite conservar el bloque funcional, pero debe repetirse
en telefono antes de atribuirle una mejora global de fluidez.

## Costes del runtime

| Metrica                 |   Baseline | Final mediana |     Final min-max |
| ----------------------- | ---------: | ------------: | ----------------: |
| Camara promedio         |   2.023 ms |      1.356 ms |    1.329-1.372 ms |
| Camara p95              |     2.8 ms |        1.7 ms |        1.7-1.8 ms |
| Camara aplicada         |    29.13/s |       29.30/s |     29.27-29.40/s |
| RoadTracker p95         |     0.1 ms |        0.1 ms |        0.1-0.2 ms |
| GeoJSON / 30 s          |        112 |           108 |           106-108 |
| Three jugador / 30 s    |       1669 |          1515 |         1490-1517 |
| MobileDrivingHud / 30 s |        150 |           152 |           150-152 |
| Heap final expuesto     | 61.035 MiB |    37.766 MiB | 35.572-40.150 MiB |
| Area util de mapa       |        n/d |         75.7% |        75.6-75.7% |

La camara cumple p95 <3 ms. No hubo `queryRenderedFeatures` con diagnostics
apagado. No se cargan tres GLB: los tres arquetipos comparten un unico modelo
local provisional y el E2E verifica una sola solicitud durante la sesion.

## Movimiento inmediato - cinco repeticiones

| Metrica                          | Mediana | Minimo | Maximo |    Criterio |
| -------------------------------- | ------: | -----: | -----: | ----------: |
| Evento touch -> input almacenado | 58.3 ms |   56.2 |   59.9 | observacion |
| Evento touch -> input consumido  | 60.6 ms |   57.9 |   62.2 | observacion |
| Consumo -> primera posicion      |  0.2 ms |    0.2 |    0.3 |     <250 ms |
| Evento -> primer frame visual    | 48.4 ms |   40.9 |   56.4 |        <1 s |
| Poll visible de primera posicion |  196 ms |    190 |    210 |     <250 ms |
| Movimiento visible total         |  269 ms |    265 |    291 |        <1 s |
| 10 km/h                          |  565 ms |    557 |    585 |        <1 s |
| 20 km/h                          |  849 ms |    768 |    892 |        <2 s |
| 30 km/h                          | 1123 ms |   1073 |   1187 |        <3 s |

Las cinco repeticiones aprobaron. El valor interno consumo -> visual fue 0 ms
porque posicion y revision visual se publicaron en el mismo tick; para evitar
una lectura engañosa se usa tambien evento -> primer frame visual.

## Experiencia automatizada

- Seleccion de objetivo de 58 km/h: 736 ms de mediana en rendimiento
  (706-777 ms).
- Tres sesiones completas de 300 s aprobaron: 0 ms inmovil y cero
  recuperaciones en las tres, red vial lista y 11 capturas por sesion.
- Primer evento y primera recompensa: mediana 2104 ms, minimo 2099 ms y maximo
  2275 ms. El evento de radio es deliberadamente la primera recompensa
  durable; no se completo ningun objetivo mediante el store.
- La lectura de area util fue 75.6-75.7% durante el escenario de rendimiento y
  72.0% al cierre de las tres sesiones completas; ambas superan el 65% exigido.
- Los artefactos se preservaron bajo `artifacts/`, fuera del directorio que
  Playwright limpia. Un smoke adicional verifico que SHA de repositorio y SHA
  mostrado por el build eran ambos
  `59896382b0fbf5f531951907ed19890f6bc9b543`.
- Primera maniobra <15 s, evento <45 s y recompensa <90 s tambien estan
  cubiertos por el E2E completo de onboarding.
- Tiempo de carga de modelo y cambio de vehiculo: n/d como duracion precisa;
  se valida funcionalmente una solicitud GLB, canvas estable y persistencia.
- Escrituras Zustand, GPU, repaints MapLibre, bateria, temperatura, audio real,
  haptics y diversion: n/d.

## Limites

El timer headless tiene cuantizacion visible alrededor de 16.7/33.4 ms. Heap
es una lectura de Chromium y no memoria total del proceso/GPU. Ninguna cifra
demuestra diversion, comodidad, ausencia de mareo o sostenibilidad termica.

# Arcade Core v0.3.0 — resultado medido

## Identidad y método

- Base: `607a12d6de95359ae95235e7e4034fe7287705a3`.
- Último commit de runtime medido:
  `64b9906e5fade1430b21165efda7af190167ebc5`.
- HEAD local al iniciar este cierre: `e91558f`.
- Entre `64b9906` y `e91558f` solo cambiaron pruebas; no hay diff en
  `src`, `public`, package, Vite, Docker o Nginx.
- Entorno: Windows, Node `v24.18.0`, npm `11.16.0`, Chromium
  `149.0.7827.55` headless, Pixel 7, `392×850`, DPR 2.
- Cada escenario comparable usa tres capturas base y tres finales, 10 s de
  warm-up, 30 s de observación, touch CDP real, un worker y cero retries.
- Diagnostics y profiling de producción: apagados.
- El comparador schema 5 exige equivalencia de trayectoria y carga dinámica.
- Esto no es una medición de teléfono físico.

Artefactos:

- `artifacts/performance-fast-64b9906/comparison-safe.json`
- `artifacts/performance-cruise-64b9906/comparison-safe.json`

## Alta velocidad

Las seis corridas conservaron superficie `trunk`, edge `10999`, ruta `idle`,
heading `244.8°`, objetivo 90 km/h y velocidad media comparable de
91.274–91.415 km/h.

| Métrica                  | Base mediana | Final mediana |    Final min–max |  Cambio |
| ------------------------ | -----------: | ------------: | ---------------: | ------: |
| FPS throughput           |       53.639 |        55.971 |    55.238–56.438 |  +4.35% |
| FPS instantáneo promedio |       56.444 |        57.843 |    57.415–58.109 |  +2.48% |
| Frametime promedio       |    18.643 ms |     17.866 ms | 17.719–18.103 ms |  -4.17% |
| Frametime p50            |      16.7 ms |       16.7 ms |     16.7–16.7 ms |       0 |
| Frametime p95            |      33.3 ms |       33.3 ms |     33.3–33.3 ms |       0 |
| Frametime p99            |      33.4 ms |       33.4 ms |     33.4–33.4 ms |       0 |
| Frames >33 ms            |          191 |           121 |          107–143 | -36.65% |
| Frames >50 ms            |            0 |             0 |              0–0 |       0 |
| Frames >100 ms           |            0 |             0 |              0–0 |       0 |
| Long tasks               |            0 |             0 |              0–0 |       0 |
| Cámara promedio          |     2.947 ms |      1.559 ms |   1.533–1.651 ms | -47.10% |
| Cámara p95               |       5.4 ms |        2.2 ms |       2.1–2.4 ms | -59.26% |
| RoadTracker p95          |       0.1 ms |        0.1 ms |       0.1–0.1 ms |       0 |
| Área útil de mapa        |          n/d |         75.9% |       75.9–75.9% |     n/d |

El gate pasa sin warnings. La cámara final permanece por debajo de 3 ms p95 en
las tres corridas y no aparecen frames >50/100 ms ni long tasks. La meta
aspiracional de reducir 25% el frametime p95 no se cumple: permanece en
33.3 ms.

El capturador final observó touch → input almacenado en 39.8 ms
(38.3–52.8) y touch → input consumido en 40.3 ms (38.9–53.4). No existe un
baseline comparable para atribuir cambio.

## Crucero contemporáneo

Las seis corridas conservaron la misma superficie, edge, ruta y heading. La
velocidad media fue 63.167–63.639 km/h en base y 63.143–64.103 km/h en final.

| Métrica                  | Base mediana | Final mediana |    Final min–max |    Cambio |
| ------------------------ | -----------: | ------------: | ---------------: | --------: |
| FPS throughput           |       57.770 |        57.304 |    57.071–57.370 |    -0.81% |
| FPS instantáneo promedio |       58.844 |        58.591 |    58.462–58.626 |    -0.43% |
| Frametime promedio       |    17.310 ms |     17.451 ms | 17.431–17.522 ms |    +0.81% |
| Frametime p50            |      16.7 ms |       16.7 ms |     16.7–16.7 ms |         0 |
| Frametime p95            |      16.8 ms |       16.8 ms |     16.8–33.2 ms | 0 mediana |
| Frametime p99            |      33.4 ms |       33.4 ms |     33.4–33.4 ms |         0 |
| Frames >33 ms            |           67 |            81 |            79–88 |   +20.90% |
| Frames >50 ms            |            0 |             0 |              0–0 |         0 |
| Frames >100 ms           |            0 |             0 |              0–0 |         0 |
| Long tasks               |            0 |             0 |              0–0 |         0 |
| Cámara promedio          |     2.271 ms |      1.600 ms |   1.589–1.765 ms |   -29.53% |
| Cámara p95               |       3.3 ms |        2.4 ms |       2.3–2.9 ms |   -27.27% |
| RoadTracker p95          |       0.1 ms |        0.1 ms |       0.1–0.1 ms |         0 |
| Área útil de mapa        |          n/d |         75.9% |       75.9–75.9% |       n/d |

El gate pasa con un warning: frames >33 ms aumentan por mediana. El baseline es
ruidoso (47–184) y los finales son más estrechos (79–88), pero eso no autoriza
a declarar mejora global. Throughput y frametime promedio empeoran levemente;
p95 mediano, frames >50/100 ms y long tasks no empeoran.

El capturador final observó touch → input almacenado en 51.7 ms
(38.1–51.9) y touch → input consumido en 52.2 ms (38.5–52.3). Tampoco existe
baseline comparable para estas latencias.

## Lectura responsable

El escenario rápido sí muestra mejora direccional clara. El crucero no muestra
mejora global de frame pacing. En ambos escenarios la cámara queda debajo de
3 ms p95 y no hay pausas >50/100 ms. Chromium headless/SwiftShader cuantiza
frametimes alrededor de 16.7/33.3 ms; una prueba física sigue siendo necesaria.

No hubo `queryRenderedFeatures` con diagnostics apagado ni actualizaciones
GeoJSON sin cambios. Los tres vehículos comparten un GLB local provisional y
no se cargan simultáneamente.

## Movimiento inmediato y reversa

El escenario móvil funcional pasó 10/10 con un worker y cero retries. Cinco
repeticiones adicionales conservaron telemetría detallada en
`artifacts/movement-head-1a8de10.json`:

| Métrica                     | Mediana | Mínimo | Máximo |    Criterio |
| --------------------------- | ------: | -----: | -----: | ----------: |
| Touch → input almacenado    | 60.0 ms |   53.9 |   61.3 | observación |
| Touch → input consumido     | 61.9 ms |   55.9 |   64.0 | observación |
| Consumo → primera posición  |  0.2 ms |    0.1 |    0.3 |     <250 ms |
| Touch → primera posición    | 62.2 ms |   56.1 |   64.1 |        <1 s |
| Touch → primer frame visual | 46.7 ms |   40.0 |   58.7 |        <1 s |
| Movimiento visible total    |  281 ms |    255 |    292 |        <1 s |
| 10 km/h                     |  566 ms |    545 |    609 |        <1 s |
| 20 km/h                     |  838 ms |    791 |    933 |        <2 s |
| 30 km/h                     | 1104 ms |   1081 |   1199 |        <3 s |

Las mismas repeticiones verifican crucero al soltar, frenado y la secuencia
detener → soltar → segundo gesto para activar reversa.

## Primeros cinco minutos

Tres sesiones completas se capturaron sobre el build exacto
`3c2b65a670577c6dfbcb7ce8a2080af7c76c696b`. Los commits posteriores hasta
`e91558f` solo cambian pruebas.

- 3/3 terminaron con red `ready`, ruta `road`, Torogoz y cero overlays.
- Tiempo inmóvil: 0 ms en las tres sesiones.
- Recuperaciones: 0 en las tres sesiones.
- Evento y recompensa: 2125, 2149 y 2164 ms; mediana 2149 ms.
- Área útil al cierre: 69.4%, 72.0% y 72.0%; mediana 72.0%.
- 11 capturas por sesión: 0, 1, 3, 8, 15, 30, 45, 75, 120, 180 y 300 s.
- El runner usa UI/touch real; no completa objetivos ni asigna recompensas por
  store.

Artefactos: `artifacts/five-minutes/final-3c2b65a/run-1..3`.

## Estado de validación local

Sobre `e91558f`:

- `npm run check`: aprobado.
- Lint y typecheck: aprobados.
- Unitarias: 96 archivos, 539 pruebas aprobadas, 0 fallidas.
- Recursos externos: 229 archivos revisados, aprobado.
- PMTiles: 64.38 MiB.
- Red vial: 17 083 nodos, 23 054 aristas, 6.02 MiB.
- Objetivos: 20 válidos y 1 excepción offroad explícita.
- Build: aprobado.
- Cámara/ruta rápida: 6/6 en `392×850`, `412×915`, `850×392`,
  `768×1024`, `360×800` y `360×640`.
- Suite E2E completa serial, un worker y cero retries: 67 aprobadas, 59
  omitidas y 1 fallo en 9.3 minutos. El único fallo fue el fallback vial del
  tutorial en móvil vertical; el mismo caso pasó en landscape.
- CI y Docker Actions del SHA final siguen pendientes; no se anticipa su
  resultado.

## Validación Docker local

La imagen diagnóstica `rutas-perdidas:v0.3.0-test` completó `npm run check`
dentro de Linux: 96 archivos, 540 unitarias, lint, typecheck, validación de
recursos y build aprobados. El primer intento había detectado un test de
readiness no aislado que importaba el grafo real de `GameMap`; se corrigió con
un mock local al test, sin tocar producción ni ampliar timeouts, y el archivo
pasó 5/5 repeticiones.

Una prueba adicional reprodujo que Nginx servía `manifest.webmanifest` como
`application/octet-stream`. Tras agregar un `location` exacto, se verificó:

- `/healthz` e índice: HTTP 200; healthcheck estable.
- CSP, service worker v0.3.0, manifest y GLB locales: aprobados.
- manifest: `application/manifest+json`.
- PMTiles Range: HTTP 206 y exactamente 1024 bytes.
- E2E seleccionada contra Docker, un worker y cero retries: 11 aprobadas, 7
  omitidas y 0 fallidas.

Imagen local:
`sha256:d08bbaf94405dcdef8f27227ee8356a08f1d2ac35c79a5d1d0ac7f5dbe098475`.
Contenedor de validación, ya detenido:
`15585b56f62ea25e9ec88fa349a9211aac93f14603ab2d0c8421ff417212b3f4`.

El build arg identificó `e91558f`. Las correcciones validadas se registraron
después como `3e24143` y `69bf3a3`. Por ello esta es evidencia Docker local del
contenido candidato, no una reconstrucción ni aprobación de Docker Actions
sobre el SHA final exacto.

## P1 pendiente: fallback vial del tutorial

La prueba `el fallback vial compartido nunca deja el runtime esperando` es
intermitente. Producción exige 1.32 s continuos de seguimiento real (900 ms de
hold + 420 ms para cerrar), pero el E2E histórico deja de dirigir tras una
muestra instantánea. Tres hipótesis se probaron sin tocar el store, ampliar el
deadline o usar clicks sintéticos:

- dirección activa hasta cierre: 3/5;
- predicado alineado a tolerancia de producción: 4/5;
- frenado determinista antes del tramo final: 1/5.

Los cambios experimentales se revirtieron según el límite de tres intentos. No
hay evidencia confirmada de deadlock de producción, pero sí un P1 de validación
que puede fallar en la suite serial. Desde `b7610bb`, la configuración global y
CI usan cero retries; la primera falla conserva su traza y Docker Actions sube
`test-results` con retención de siete días. El cierre exige una corrida serial
completamente aprobada.

### P1 adicional: escenario visual de ruta rápida

Una corrida completa posterior sobre `50bd674`, un worker y cero retries,
detectó un chevron `3.107 px` fuera del mapa en landscape: `2.107 px` más allá
de la tolerancia de 1 px. También agotó el límite externo de 15 minutos antes
del resumen completo. La causa confirmada fue temporal en el E2E: tras alcanzar
60 km/h sobre ruta, hacía unas 15 aserciones sin steering y medía cuando ya
había rebasado la maniobra y salido de la vía.

Tres correcciones de prueba —captura temprana atómica, steering CDP durante la
espera y snapshot correlacionado— no estabilizaron la ejecución con traza
pesada. Resultados finales por hipótesis: la primera pasó 15/15 sin traza, pero
una aserción posterior observó bajo traza un perfil `mobileDriving` legítimo;
las siguientes pasaron 2/5 y 1/5 con traza. La traza elevó la frecuencia, aunque
el flake original también apareció sin instrumentación. Se revirtieron todos
los cambios experimentales según el límite de tres intentos. La tolerancia
geométrica permanece en 1 px y el runtime no cambió. Este punto requiere un
controlador E2E vial dedicado antes de repetir la suite completa.

## Límites

`npm run check` sobre `b7610bb` aprobó 97 archivos y 542 unitarias, junto con
lint, typecheck, recursos, PMTiles, red vial, objetivos y build.

Tiempo preciso de carga/cambio de vehículo, escrituras Zustand, GPU, repaints
MapLibre, memoria total, batería, temperatura, audio real, hápticos y diversión:
n/d. La automatización no confirma comodidad del joystick, sensación de
velocidad, mareo, fatiga, legibilidad al sol ni sostenibilidad térmica.

# Arcade Core v0.3.0 — informe de playtest automatizado

## Identidad

- Base: `607a12d6de95359ae95235e7e4034fe7287705a3`.
- Último runtime medido:
  `64b9906e5fade1430b21165efda7af190167ebc5`.
- Rama: `codex/v0.3.0-arcade-core`.
- HEAD local previo a la documentación final: `e91558f`.
- Los commits posteriores a `64b9906` solo cambian pruebas.
- La automatización no sustituye un playtest físico.

## Problemas priorizados

1. Arranque inmóvil: objetivo inicial 0 y tutorial capaz de pedir giro sin
   movimiento.
2. Offroad confundido con bloqueo: límite universal de 25%, sin gracia ni
   reincorporación.
3. Jerarquía visual/cámara: vehículo y navegación competían, y la cámara usaba
   el canvas completo en vez del espacio libre de controles.

## Resultado funcional implementado

- `arcade-driving` es predeterminado solo para partidas nuevas.
- Primer gesto acelera; soltar mantiene crucero; frenar no activa reversa hasta
  detener, soltar y volver a arrastrar hacia abajo.
- Partidas anteriores conservan controles válidos y migran sin perder misión,
  objetivo, inventario, XP, descubrimientos, combustible, condición,
  checkpoints, bitácora o posición.
- Detector puro de inmovilidad y ayuda compacta con causa real.
- `REINCORPORAR` valida vía, 120 m máximos, objetivo offroad, zona restringida
  y narrativa; conserva progreso, limpia input, alinea heading, recalcula y
  guarda checkpoint sin castigo.
- Offroad arcade: gracia de 1750 ms y ocho misses; 60% normal, 45% terreno
  difícil/track y 80% vía no clasificada o reincorporación cercana.
- Vehículo y navegación usan clases, colores, tamaños y etiquetas distintos;
  navegación por chevrons de menor jerarquía.
- `SafeGameplayViewport` y perfiles stopped/cruise/fast/interaction/recovery,
  con cadencia adaptativa e histéresis.
- HUD compacto, vitales saludables discretos, descubrimiento temporal y radio
  compacta. Las sesiones de cinco minutos conservaron 69.4–72.0% de mapa útil.
- Feedback ligero: vehículo legible, luces de freno, polvo solo en tierra,
  audio por velocidad/perfil y `prefers-reduced-motion`.
- Evento/recompensa ligera persistente e idempotente.
- Catálogo `VehicleDefinition`, tres arquetipos, skins, stats aplicadas,
  unlocks, selección persistente y migración save v6.
- Garaje móvil sin importar Three.js en el título; el GLB se carga al conducir.
- PWA v0.3.0 con identidad de build; no intercepta PMTiles ni Range Requests.

## Vehículos y assets provisionales

| Vehículo   | Perfil                                             | Desbloqueo             |
| ---------- | -------------------------------------------------- | ---------------------- |
| Torogoz    | equilibrado y durable                              | inicial                |
| Volcán GT  | más velocidad/aceleración, menor offroad/autonomía | `la-transmision`       |
| Coyote 4x4 | más agarre/durabilidad, menor velocidad máxima     | `senales-en-suchitoto` |

Los tres reutilizan temporalmente `/models/expedition-vehicle.glb`: 34 056
bytes, 312 triángulos, sin texturas ni URI externas. Las skins son distintas,
pero todavía no existen tres modelos definitivos. No se cargan tres GLB.

## Evidencia exacta

### Movimiento

- Movimiento/reversa funcional: 10/10, un worker, cero retries.
- Telemetría adicional: 5/5.
- Touch → input almacenado: mediana 60.0 ms, rango 53.9–61.3 ms.
- Touch → input consumido: 61.9 ms, 55.9–64.0 ms.
- Touch → primera posición: 62.2 ms, 56.1–64.1 ms.
- Movimiento visible total: 281 ms, 255–292 ms.
- 10 km/h: 566 ms; 20 km/h: 838 ms; 30 km/h: 1104 ms.

Fuente: `artifacts/movement-head-1a8de10.json`.

### Rendimiento

- Alta velocidad, 3×3: throughput +4.35%, frametime promedio -4.17%, frames
  > 33 ms -36.65%, p95 33.3 → 33.3 ms y cámara p95 5.4 → 2.2 ms.
- Crucero, 3×3: throughput -0.81%, frametime promedio +0.81%, frames >33 ms
  +20.90%, p95 mediano 16.8 → 16.8 ms y cámara p95 3.3 → 2.4 ms.
- Ambos: cero frames >50/100 ms, cero long tasks y RoadTracker p95 0.1 ms.
- No se afirma mejora global: el escenario de crucero conserva un warning.

Fuentes: `artifacts/performance-fast-64b9906` y
`artifacts/performance-cruise-64b9906`.

### Primeros cinco minutos

- 3/3 sesiones de 300 s; SHA de repositorio y build: `3c2b65a`.
- 33 capturas en total.
- Tiempo inmóvil: 0 ms en las tres.
- Recuperaciones: 0.
- Primer evento/recompensa: 2125–2164 ms; mediana 2149 ms.
- Área útil final: 69.4–72.0%; mediana 72.0%.
- Red `ready`, ruta `road`, Torogoz y cero overlays al cierre.

Fuente: `artifacts/five-minutes/final-3c2b65a/run-1..3`.

### Estado local de cierre

En `e91558f`:

- `npm run check`: aprobado.
- 96 archivos y 539 pruebas unitarias aprobadas.
- 229 recursos revisados sin solicitudes externas.
- PMTiles 64.38 MiB; red 17 083 nodos/23 054 aristas/6.02 MiB.
- 20 objetivos viales válidos y 1 excepción offroad explícita.
- Build aprobado.
- Ruta/cámara rápida: 6/6 en seis viewports, incluido `360×640`.
- E2E completa serial, un worker, cero retries: 67 aprobadas, 59 omitidas y 1
  fallo en 9.3 minutos. El fallo fue el fallback vial en móvil vertical; el
  mismo escenario pasó en landscape.
- GitHub Actions debe anotarse sobre el SHA final exacto; no se anticipa su
  resultado.

### Validación Docker local del candidato

La imagen diagnóstica `rutas-perdidas:v0.3.0-test` se construyó y ejecutó
localmente. El primer `npm run check` dentro de Linux expuso un unit test no
aislado: `startScreenFullscreen.test.tsx` importaba el grafo real de `GameMap`
bajo concurrencia. Se agregó un mock local del componente, sin cambiar runtime
ni timeouts; el archivo pasó 5/5 repeticiones y el check completo posterior
aprobó 96 archivos y 540 pruebas.

La primera consulta del manifest devolvió `application/octet-stream`. Una
prueba nueva reprodujo el fallo antes de configurar el `location` exacto de
Nginx. Después del cambio:

- `/healthz` e índice: HTTP 200; contenedor saludable.
- CSP, manifest, service worker y ambos GLB: aprobados.
- `manifest.webmanifest`: `application/manifest+json`.
- PMTiles: HTTP 206 y exactamente 1024 bytes para el rango solicitado.
- E2E seleccionada contra Docker, un worker y cero retries: 11 aprobadas, 7
  omitidas y 0 fallidas; cubrió migración, recuperación de condición, garaje,
  persistencia, movimiento arcade, autonomía y PWA.
- Imagen local: `sha256:d08bbaf94405dcdef8f27227ee8356a08f1d2ac35c79a5d1d0ac7f5dbe098475`.
- Contenedor de validación, ya detenido:
  `15585b56f62ea25e9ec88fa349a9211aac93f14603ab2d0c8421ff417212b3f4`.

Esta imagen usó `e91558f` como SHA embebido. Los dos cambios verificados se
registraron después como `3e24143` (aislamiento del unit test) y `69bf3a3`
(MIME PWA). La corrida demuestra la validación Docker local del contenido, pero
no sustituye una reconstrucción ni Docker Actions sobre el SHA final exacto.

## Hallazgos de subagentes

Hechos confirmados:

- **Performance profiler:** cámara/MapLibre/Three y fanout UI eran los costes
  principales; RoadTracker no era cuello de botella. Dos runtimes WebGL
  paralelos contaminaban las mediciones.
- **Onboarding auditor:** narrativa/tutorial/gates podían dejar el primer gesto
  sin explicación y el mini navegador competía con controles básicos.
- **Gameplay experience auditor:** objetivo 0, offroad severo, flecha parecida
  al jugador, cámara sobre canvas y exceso de tarjetas eran los cinco problemas
  de mayor impacto.
- **Regression reviewers:** detectaron pausa desde garaje, stats incompletas,
  readiness/PWA, aviso de migración bloqueante, contrato fallback permisivo,
  identidad débil de capturas y consumo oculto de consejos. Los P0/P1 de
  runtime fundamentados se corrigieron.
- **Regression reviewer de `e91558f`:** acepta la tolerancia geométrica
  simétrica de 1 px para un desborde observado de 0.107 px, pero mantiene como
  P1 el E2E inestable de promoción fallback→ruta. No encontró un deadlock de
  producción.
- **Regression reviewer Docker/PWA:** no encontró P0 ni regresiones de runtime;
  aprobó conservar el mock unitario y el `location` exacto de Nginx. Marcó como
  P1 de proceso reconstruir sobre el SHA final, y como P2 agregar cobertura
  separada para fallo del chunk cartográfico y headers HTTP en el workflow.

## P1 pendiente de validación

`mobile-controls.spec.ts` contiene un controlador histórico que deja de dirigir
después de una condición instantánea; producción exige 1.32 s continuos de
seguimiento real. Tres intentos reversibles dieron 3/5, 4/5 y 1/5. Se
revirtieron al no demostrar mejora.

El problema pendiente es del escenario E2E, no evidencia confirmada de que el
runtime quede bloqueado. Aun así impide declarar la suite estable. Desde
`b7610bb`, Playwright usa cero retries también en CI, conserva la traza del
primer fallo y Docker Actions publica `test-results` durante siete días. La
aceptación final sigue exigiendo una corrida serial completamente aprobada.

### Flake E2E de geometría de navegación rápida

La corrida completa exacta de `50bd674`, un worker y cero retries, encontró
además un desborde del chevron de ruta en landscape: `395.107 px` frente a un
borde de mapa de `392 px` más 1 px de tolerancia. La corrida fue interrumpida
por el límite externo de 15 minutos antes de completar los 127 casos.

La traza confirmó que el runtime estaba alineado al alcanzar 60 km/h. El E2E
ejecutaba después unas 15 aserciones sin dirección lateral; al medir ya estaba
fuera de ruta y el marcador geográfico quedaba recortado. No hubo cambios de
runtime entre `e91558f` y `50bd674`.

Se probaron tres hipótesis reversibles sin ampliar tolerancias ni timeouts:

- mover la captura al estado on-road y leer la geometría atómicamente;
- sostener dirección con CDP touch mientras esperaba `mobileFast`;
- devolver una única captura correlacionada de ruta, cámara y safe viewport.

La primera pasó 15/15 sin traza, pero con traza expuso una carrera temporal de
muestreo del E2E: una aserción posterior observó un perfil `mobileDriving`
legítimo. Las siguientes no estabilizaron el caso instrumentado: 2/5 y 1/5. La
traza aumentó la frecuencia, pero el flake original también ocurrió en la suite
normal. Todos los cambios experimentales se revirtieron. Queda pendiente
diseñar un controlador E2E de seguimiento vial que mantenga la maniobra real
bajo carga; no se considera evidencia de regresión del runtime.

## Riesgos y límites

Validación local posterior sobre `b7610bb`: `npm run check` aprobado con 97
archivos y 542 pruebas unitarias, además de lint, typecheck, recursos locales,
PMTiles, red vial, objetivos y build.

- Crucero: frames >33 ms aumentan por mediana; medir en teléfono.
- La suite completa sigue bloqueada por dos escenarios E2E de seguimiento vial:
  fallback del tutorial y geometría de navegación rápida.
- Los tres vehículos comparten un GLB provisional.
- PWA con service worker está automatizada en Desktop Chrome; falta combinar
  SW real con viewport móvil `392×850` contra Docker.
- Falta una prueba sostenida de memoria tras ciclos repetidos garaje/juego.
- PMTiles/Range se excluyen del service worker; no se promete mapa completo
  offline en primera sesión.
- Carga/cambio de vehículo, escrituras Zustand, GPU, batería, temperatura,
  audio real y hápticos: n/d.
- Automatización no confirma diversión, comodidad, sensación de velocidad,
  mareo, fatiga, legibilidad al sol ni sonido real.

## Próximo playtest

Cinco personas sin explicar controles, alternando navegador y PWA. Registrar
tiempo al primer movimiento, reversas accidentales, uso espontáneo de
reincorporación, confusión vehículo/ruta, carga visual, preferencia de vehículo,
calor y batería. Consolidar observaciones antes de reemplazar assets o agregar
contenido.

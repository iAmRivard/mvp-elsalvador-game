# v0.3.1 — resultado optimizado de cámara y mapa

## Identidad y método

- Base real: `8d7d75ddb0cfeb7331309ff7f369ba0731ee2090`.
- Baseline comparable: `4deb46d93118010eed63ccc9174852c41ded8e6d`.
- SHA de runtime final medido: `9d3bba9da5d9669dd89e2b58eba04b15ba7341b4`.
- Rama: `codex/v0.3.1-camera-map-readability`.
- Paquete/PWA: `0.3.1`.
- Chromium headless `149.0.7827.55`, Pixel 7, `392 × 850`, DPR `2.625`.
- Producción normal, diagnósticos deshabilitados, 5 s de warm-up y 30 s de
  observación (`30,077.1 ms`).
- Misma ruta, posición, touch real, calidad y fuente `player-projection` a
  4 Hz que el baseline instrumentado.

Los artefactos locales están en
`test-results/camera-map-v0.3.1-final-stable-30s` y no se versionan.

## Comparación

| Métrica                       |    Baseline |      v0.3.1 |           Cambio |
| ----------------------------- | ----------: | ----------: | ---------------: |
| Posiciones distintas (0.1 px) |          37 |         119 |          +221.6% |
| Movimiento promedio           |    0.105 px |    0.266 px |          +153.3% |
| Movimiento p95                |    0.470 px |    1.302 px |          +177.0% |
| Movimiento p99                |    0.960 px |    6.112 px |          +536.7% |
| Transición máxima             |    42.90 px |    43.03 px |          neutral |
| Cámara aplicada               |     28.65/s |     28.79/s |            +0.5% |
| Cámara promedio               |    1.627 ms |    1.624 ms |            -0.2% |
| Cámara p95                    |      2.4 ms |      2.4 ms |          neutral |
| Cámara p99                    |      3.1 ms |      3.1 ms |          neutral |
| Intervalo de cámara p95       |     43.2 ms |     45.0 ms |          +1.8 ms |
| Intervalo de cámara p99       |     86.4 ms |     90.3 ms |          +3.9 ms |
| Frametime promedio            |    20.52 ms |    19.60 ms |            -4.5% |
| Frametime p95                 |     33.4 ms |     33.4 ms |          neutral |
| Frametime p99                 |     33.5 ms |     33.4 ms |          -0.1 ms |
| Frames >33 ms                 |         273 |         212 |           -22.3% |
| Frames >50 ms                 |          14 |          13 |            -7.1% |
| Frames >100 ms                |           5 |           5 |          neutral |
| Cadencia final                |       30 Hz |       30 Hz |      cumple piso |
| Zoom/pitch final              | 15.55 / 58° | 15.70 / 57° |        más cerca |
| Área útil final               |       75.9% |       75.9% |          neutral |
| Vehículo fuera del viewport   |          no |          no |          neutral |
| Capas `symbol` visibles       |         n/a |           3 |   contador nuevo |
| Etiquetas renderizadas        |         n/a |         n/a | diagnósticos off |

El frametime p95 no mejoró 25%; permanece cuantizado en 33.4 ms. Sí mejoró la
distribución: 61 frames menos sobre 33 ms, uno menos sobre 50 ms y ningún
aumento sobre 100 ms. No se atribuye causalidad física ni se oculta esta meta
no alcanzada.

## Cambios conservados

- Zona móvil acotada: ±16 px horizontal, ±11 px vertical y desborde máximo de
  8 px; respuesta exponencial por tiempo, snap de carga/rejoin/teleport y
  comportamiento específico para reduced motion.
- Bearing limitado por grados/segundo, no por actualización.
- Cadencia mínima de 30 Hz mientras se conduce; 45/60 Hz siguen sujetos a
  histéresis y evidencia de ventanas saludables.
- Lookahead progresivo de 10–55 m por velocidad. Usa próxima maniobra/ruta
  cuando existe y heading como fallback; se desactiva en reversa y se reduce
  durante interacción/recuperación.
- Perfil B seleccionado: móvil driving `15.70/57°`, fast `15.55/58.5°` y
  stopped `15.75/54°`; no se cambió velocidad física.
- Vehículo Three.js: 44 px en medium móvil, 48 px en high móvil; escritorio
  conserva 34/42 px. Lean máximo ~2° y pitch ~1.4°, sin geometrías/materiales
  por frame y deshabilitados con reduced motion.
- Modo explícito `exploration`, `arcade-driving`, `arcade-fast`; detenerse en
  misión mantiene arcade. El control móvil ahora permite entrar y salir de
  exploración explícitamente.
- `place-labels-major` queda visible; `place-labels-local`, `poi-labels`,
  calles menores y edificios usan `visibility: none` en gameplay. Fast oculta
  además contexto secundario.
- Inventario/estilo se cachean. Los atributos de captura se muestrean a 4 Hz,
  no por frame. La visibilidad publicada se relee de MapLibre y reporta fallos.
- Un debounce de 120 ms evita obedecer geometrías transitorias del HUD. El
  máximo bajó de 140 px en la corrida diagnóstica a 43.03 px, igual al baseline.

## Resultado técnico

- Cámara p95: 2.4 ms, debajo de 3 ms.
- Piso de conducción: 30 Hz.
- Área útil: 75.9%, encima de 70%.
- Ruta, objetivo, major label y vehículo permanecen disponibles.
- POI y lugares locales quedan fuera de colocación durante gameplay.
- No se añadió WebGPU, canvas adicional, post-processing ni contenido nuevo.

Esta evidencia autoriza solamente un playtest físico enfocado. Siguen
pendientes onboarding completo, recorrido corto, sesión de 15 minutos,
respuesta/tirones, calentamiento, audio, hápticos, safe areas, reversa, Turbo,
bitácora y objetivos en un móvil real.

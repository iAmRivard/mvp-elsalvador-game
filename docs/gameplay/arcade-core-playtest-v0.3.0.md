# Arcade Core v0.3.0 — informe de playtest automatizado

## Objetivo y problemas priorizados

Convertir el primer recorrido en conducción arcade inmediata, legible y
recuperable sin borrar modos avanzados ni romper guardados, misiones, rutas,
PWA o despliegue autónomo.

1. **Arranque inmóvil.** La velocidad objetivo iniciaba en 0 y el tutorial
   podía pedir giro sin movimiento.
2. **Offroad confundido con bloqueo.** Existía un límite universal de 25% sin
   gracia ni reincorporación.
3. **Jerarquía visual y cámara.** Vehículo/navegación competían visualmente y
   la cámara usaba el canvas completo, no el espacio libre de controles.

## Resultado funcional

- `arcade-driving` es el modo predeterminado solo para partidas nuevas.
- El primer gesto acelera, soltar conserva crucero y frenar no arma reversa
  hasta detenerse, soltar y volver a arrastrar hacia abajo.
- Partidas anteriores conservan preferencias válidas y reciben aviso de la
  nueva opción sin bloquear acciones.
- Detector puro de vehículo inmóvil y ayuda compacta con la causa real.
- `REINCORPORAR` valida vía, distancia máxima de 120 m, objetivo offroad, zona
  restringida y narrativa; alinea posición/heading, limpia input, recalcula
  ruta y guarda checkpoint sin castigo.
- Offroad arcade: gracia de 1750 ms y ocho misses, 60% normal, 45% terreno
  difícil/track y 80% vía no clasificada o reincorporación cercana.
- Vehículo y navegación tienen clases, colores, tamaños y etiquetas distintas;
  la navegación usa chevrons y menor jerarquía.
- Cámara con `SafeGameplayViewport`, perfiles
  stopped/cruise/fast/interaction/recovery e histéresis adaptativa.
- HUD móvil compacto, vitales saludables discretos, descubrimiento de 2.75 s,
  radio compacta y área útil automatizada de 72.0–81.2%.
- Feedback ligero: vehículo más legible, luces de freno, polvo solo en tierra,
  audio por velocidad/perfil y respeto a `prefers-reduced-motion`.
- Primer evento entrega un fragmento de historia persistente e idempotente.
- Catálogo `VehicleDefinition`, tres arquetipos, skins, estadísticas aplicadas,
  unlocks, selección persistente y migración save v6.
- Garaje móvil sin importar Three.js en el título; el GLB se carga al conducir.
- PWA v0.3.0 con identidad de build; no intercepta PMTiles ni Range Requests.

## Vehículos y assets provisionales

| Vehículo | Perfil | Desbloqueo |
|---|---|---|
| Torogoz | equilibrado y durable | inicial |
| Volcán GT | más velocidad/aceleración, menor offroad/autonomía | completar `la-transmision` |
| Coyote 4x4 | más agarre/durabilidad, menor velocidad máxima | completar `senales-en-suchitoto` |

Los tres reutilizan temporalmente `/models/expedition-vehicle.glb` (34 056
bytes, 312 triángulos, sin texturas ni URI externas) con skins distintas. Es
un asset provisional, no tres modelos definitivos. No se cargan tres GLB.

## Guardados

- Save version 6; fixtures sin versión/0 y versiones 1–5 migran.
- Campos de vehículo ausentes o IDs/skins inválidos hacen fallback a Torogoz.
- Desbloqueos se derivan retroactivamente de misiones completadas.
- Se conservan misión, objetivo, inventario, XP, descubrimientos, combustible,
  condición, checkpoints, bitácora, posición y control válido.

## Evidencia automatizada

- Baseline: 403 unitarias aprobadas y 57 E2E aprobadas, sin fallos.
- Movimiento arcade: 10/10 repeticiones funcionales; cinco conservaron
  telemetría detallada con movimiento visible mediano de 269 ms, 20 km/h en
  849 ms y 30 km/h en 1123 ms.
- Fallback y promoción vial: 5/5 repeticiones fortalecidas; el mismo pointer
  permanece activo hasta observar desplazamiento real tras promover a `road`.
- Onboarding completo con interacciones reales: aprobado tras exigir guía
  fallback accionable y progreso directo que reduce distancia hasta `arrive`.
- Primeros cinco minutos: 3/3 sesiones de 300 s sobre
  `9677ff8a213ca9edc7ab18d506307720ea44f750`, cero tiempo inmóvil, cero
  recuperaciones, 11 capturas por sesión y evento/recompensa en 2102–2159 ms.
- Garaje: UI real, bloqueado no seleccionable, una solicitud GLB, canvas no
  recreado y persistencia después de reload.
- PWA: instalación, reload offline del shell, assets versionados, red vial,
  ambos GLB, ciclo de update, misión activa diferida y Range 206/1024 sin cache.
- Rendimiento comparable 3×3: p95 33.4 ms, 0 frames >50/100 ms, cámara p95
  final 2.0 ms y RoadTracker p95 0.1 ms. El promedio y frames >33 ms empeoran;
  no se afirma una mejora global de fluidez.
- La matriz completa se vuelve a ejecutar antes del push.

## Automatización de cinco minutos

Con build/preview de producción:

```bash
npm run capture:arcade-five-minutes -- http://127.0.0.1:4173 artifacts/five-minutes-run-1
```

El runner rechaza worktrees sucios o builds obsoletos, limpia almacenamiento,
usa clicks y touch CDP reales, conduce, orienta hacia la ruta, escucha la señal
y usa reincorporación visible si hace falta. No completa objetivos ni asigna
recompensas mediante store.

## Hallazgos de subagentes

Hechos confirmados:

- **Performance profiler:** cámara/MapLibre/Three y el fanout UI eran los
  costes principales; RoadTracker no era cuello de botella.
- **Onboarding auditor:** narrativa/tutorial/gates podían dejar el primer gesto
  sin explicación y el mini navegador competía con controles básicos.
- **Gameplay experience auditor:** objetivo 0, penalización offroad, flecha
  parecida al jugador, cámara sobre canvas y exceso de tarjetas eran los cinco
  problemas principales.
- **Regression reviewers:** detectaron pausa incorrecta desde garaje, stats
  incompletas, assets PWA/readiness, aviso de migración bloqueante, contrato
  fallback permisivo e identidad de capturas débil. Los P0/P1 fundamentados se
  corrigieron y probaron. Se ejecuta una revisión final después de la matriz.

## Riesgos pendientes y validación física

- Throughput y frames >33 ms del headless empeoraron aunque p95, >50 ms y
  >100 ms conservaron el gate. Debe medirse en teléfonos reales.
- Los tres vehículos comparten GLB provisional. Un modelo futuro distinto
  requiere reemplazo y disposición imperativa de recursos Three.js.
- Falta confirmar focus trap/restauración de foco del garaje en una auditoría
  dedicada de teclado.
- ETA de routing sigue siendo aproximada.
- PMTiles/Range se excluyen deliberadamente del service worker; no se promete
  mapa completo offline en la primera sesión.
- Automatización no confirma diversión, comodidad, sensación de velocidad,
  vibración, temperatura, batería, mareo, fatiga, sol ni sonido real.

## Próximo playtest

Cinco personas sin explicar controles, alternando navegador y PWA. Registrar
tiempo al primer movimiento, errores de reversa, uso espontáneo de
reincorporación, confusión vehículo/ruta, carga visual, preferencia de vehículo,
calor y batería. Consolidar observaciones antes de reemplazar assets o agregar
contenido.

# Arcade Core v0.3.0 — informe de playtest automatizado

## Identidad

- Base: `607a12d6de95359ae95235e7e4034fe7287705a3`.
- Runtime final medido: `1a8de1021b4547bb848ea4626a873f3876dcd129`.
- Rama: `codex/v0.3.0-arcade-core`.
- El commit documental posterior no cambia runtime. Docker y GitHub Actions se
  validan sobre el SHA final exacto antes del cierre.
- La automatización no sustituye un playtest físico.

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
- La ayuda de arranque/recuperación pausa semánticamente los consejos
  contextuales: no consume sus temporizadores oculta y el consejo reaparece al
  cerrar la ayuda.
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
  radio compacta y área útil automatizada de 72.0–81.2% al cierre de las
  sesiones de cinco minutos.
- Feedback ligero: vehículo más legible, luces de freno, polvo solo en tierra,
  audio por velocidad/perfil y respeto a `prefers-reduced-motion`.
- Primer evento entrega un fragmento de historia persistente e idempotente.
- Catálogo `VehicleDefinition`, tres arquetipos, skins, estadísticas aplicadas,
  unlocks, selección persistente y migración save v6.
- Garaje móvil sin importar Three.js en el título; el GLB se carga al conducir.
- PWA v0.3.0 con identidad de build; no intercepta PMTiles ni Range Requests.
- Playwright usa un solo runtime MapLibre/WebGL en CI; local conserva dos
  workers. No se cambiaron assertions, calidad, timeouts ni cobertura.

## Vehículos y assets provisionales

| Vehículo   | Perfil                                             | Desbloqueo                       |
| ---------- | -------------------------------------------------- | -------------------------------- |
| Torogoz    | equilibrado y durable                              | inicial                          |
| Volcán GT  | más velocidad/aceleración, menor offroad/autonomía | completar `la-transmision`       |
| Coyote 4x4 | más agarre/durabilidad, menor velocidad máxima     | completar `senales-en-suchitoto` |

Los tres reutilizan temporalmente `/models/expedition-vehicle.glb` (34 056
bytes, 312 triángulos, sin texturas ni URI externas) con skins distintas. Es
un asset provisional, no tres modelos definitivos. No se cargan tres GLB.

## Guardados

- Save version 6; fixtures sin versión/0 y versiones 1–5 migran.
- Campos de vehículo ausentes o IDs/skins inválidos hacen fallback a Torogoz.
- Desbloqueos se derivan retroactivamente de misiones completadas.
- Se conservan misión, objetivo, inventario, XP, descubrimientos, combustible,
  condición, checkpoints, bitácora, posición y control válido.

## Evidencia automatizada exacta

- `npm run check`: 93 archivos de prueba, 501 unitarias aprobadas; lint,
  typecheck, recursos externos, PMTiles, red vial, objetivos y build aprobados.
- E2E completa con un worker y cero retries: dos pasadas consecutivas, cada una
  con 66 aprobadas, 57 omitidas por matriz/proyecto y 0 fallos.
- Movimiento arcade/reversa: 10/10 funcionales; cinco capturas detalladas con
  movimiento visible mediano de 281 ms, 10 km/h en 566 ms, 20 km/h en 838 ms
  y 30 km/h en 1104 ms.
- Reincorporación: 15/15 escenarios repetidos (cerca, fuera del límite y
  objetivo offroad legítimo).
- Cámara/HUD: 30/30, cinco veces por cinco viewports y cinco ciclos de perfiles;
  incluye `392×850`, `412×915`, landscape y móvil corto `360×640`.
- Garaje/cambio/persistencia: 5/5, una solicitud GLB y canvas conservado.
- PWA real: 6/6, dos escenarios × tres repeticiones con SW habilitado.
- Offroad puro: 210/210 aserciones acumuladas; guardados/configuración/vehículo:
  180/180 aserciones acumuladas.
- Primeros cinco minutos: 3/3 sesiones de 300 s, 33 capturas, cero tiempo
  inmóvil, cero recuperaciones, evento/recompensa en 2012–2190 ms y área útil
  final 72.0–81.2%.
- Rendimiento comparable 3×3: frametime p95 33.4 ms, 0 frames >50/100 ms,
  cámara p95 final 1.7 ms y RoadTracker p95 0.1 ms. El promedio y frames
  > 33 ms empeoran frente a la base; no se afirma una mejora global de fluidez.

El intento inicial de la tanda movimiento 10× fue inválido porque el proceso
preview expiró tras una hora: los diez casos recibieron
`ERR_CONNECTION_REFUSED` antes de entrar al juego. Se reinició el mismo build y
la tanda válida pasó 10/10 sin retries. La incidencia queda documentada y no se
presenta como un flake de gameplay.

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
  costes principales; RoadTracker no era cuello de botella. Dos sesiones
  WebGL paralelas en el runner Docker contaminaron FPS y gates temporales.
- **Onboarding auditor:** narrativa/tutorial/gates podían dejar el primer gesto
  sin explicación y el mini navegador competía con controles básicos.
- **Gameplay experience auditor:** objetivo 0, penalización offroad, flecha
  parecida al jugador, cámara sobre canvas y exceso de tarjetas eran los cinco
  problemas principales.
- **Regression reviewers:** detectaron pausa incorrecta desde garaje, stats
  incompletas, assets PWA/readiness, aviso de migración bloqueante, contrato
  fallback permisivo, identidad de capturas débil y consumo invisible de un
  consejo oculto. Los P0/P1 fundamentados se corrigieron y probaron.
- **Revisión de CI:** aprobó el perfil determinista 8/8 para el E2E que exige
  Three, la exclusión semántica de ayudas y un worker CI sin reducir cobertura.

## Riesgos pendientes y validación física

- Frente a la base, throughput baja 1.67%, frametime promedio sube 1.70% y
  frames >33 ms suben 10.32%, aunque p95/p99 se mantienen y no hay frames
  > 50/100 ms. Debe medirse en teléfonos reales.
- Los tres vehículos comparten GLB provisional. Un modelo futuro distinto
  requiere reemplazo y disposición imperativa de recursos Three.js.
- Falta un E2E específico de garaje en hardware 4/4 que confirme la variante
  de marcador 2D; la degradación `medium → low` sí está cubierta unitariamente.
- Falta confirmar focus trap/restauración de foco del garaje en una auditoría
  dedicada de teclado.
- ETA de routing sigue siendo aproximada.
- PMTiles/Range se excluyen deliberadamente del service worker; no se promete
  mapa completo offline en la primera sesión.
- Tiempo preciso de carga/cambio de vehículo, escrituras Zustand, GPU, batería,
  temperatura, audio real y haptics: n/d.
- Automatización no confirma diversión, comodidad, sensación de velocidad,
  vibración, temperatura, batería, mareo, fatiga, sol ni sonido real.

## Próximo playtest

Cinco personas sin explicar controles, alternando navegador y PWA. Registrar
tiempo al primer movimiento, errores de reversa, uso espontáneo de
reincorporación, confusión vehículo/ruta, carga visual, preferencia de vehículo,
calor y batería. Consolidar observaciones antes de reemplazar assets o agregar
contenido.

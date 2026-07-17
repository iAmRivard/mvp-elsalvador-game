# Arcade Core v0.3.0 - informe de playtest automatizado

## Objetivo

Convertir el primer recorrido en una conduccion arcade inmediata, legible y
recuperable sin borrar modos avanzados ni romper guardados, misiones, rutas,
PWA o despliegue autonomo.

## Problemas priorizados y resultado

1. **Arranque inmovil.** El modo de velocidad objetivo comenzaba en 0 y el
   tutorial podia pedir giro sin movimiento. Nueva partida usa
   `arcade-driving`, el primer gesto acelera, soltar conserva crucero y frenar
   no arma reversa hasta detener-soltar-volver a bajar.
2. **Offroad confundido con bloqueo.** Se elimino el 25% universal, se agrego
   gracia de 1750 ms y ocho misses, superficies separadas y reincorporacion
   segura hasta 120 m sin penalizacion.
3. **Jerarquia visual y camara.** El vehiculo usa silueta/color propios; la
   navegacion usa tres chevrons dorados. La camara sigue un
   `SafeGameplayViewport` y perfiles stopped/cruise/fast/interaction/recovery.

## Cambios funcionales

- Modo nuevo `arcade-driving`, predeterminado solo para partidas nuevas.
- Preferencias validas de partidas anteriores se conservan.
- Detector puro de vehiculo inmovil y ayuda con causa real.
- Accion `REINCORPORAR`: valida via, distancia, objetivo offroad, zona
  restringida y narrativa; alinea posicion/heading, limpia input, recalcula
  ruta y guarda checkpoint.
- Multiplicadores arcade: track/dirt 45%, via no clasificada 80%, offroad 60%,
  con agarre y consumo por vehiculo.
- HUD movil en una fila, vitales saludables discretos, descubrimiento 2.75 s y
  radio compacta. Area util medida: 75.6-75.7%.
- Feedback ligero ya local: luces de freno, polvo solo en terreno, audio por
  velocidad/perfil, haptics existentes y respeto a reduced motion.
- Primer evento entrega un fragmento de historia persistente e idempotente.
- Catalogo `VehicleDefinition`, tres arquetipos, skins, estadisticas reales,
  unlocks, seleccion persistente y migracion de save v6.
- Garaje movil sin Three en titulo; el GLB se carga al conducir.
- PWA v0.3.0 precachea shell, chunks, worker, fuentes, red vial y ambos GLB con
  identidad SHA. Nunca intercepta PMTiles/Range y rechaza un manifiesto de otro
  build antes de abrir caches.
- Menus muestran version y SHA del build.

## Vehiculos

| Vehiculo   | Perfil                                               | Desbloqueo                       |
| ---------- | ---------------------------------------------------- | -------------------------------- |
| Torogoz    | equilibrado y durable                                | inicial                          |
| Volcan GT  | mas velocidad/aceleracion, menos offroad y autonomia | completar `la-transmision`       |
| Coyote 4x4 | mas agarre/durabilidad, menor velocidad              | completar `senales-en-suchitoto` |

Los tres usan temporalmente `/models/expedition-vehicle.glb` (34,056 bytes,
312 triangulos, sin texturas ni URI externas) con skins claramente distintas.
Es un asset provisional, no tres modelos definitivos.

## Guardados

- Save version 6.
- Versiones sin version/0 y 1-5 migran al vehiculo inicial si faltan campos.
- IDs desconocidos, seleccion bloqueada y skin invalida hacen fallback seguro.
- Desbloqueos se derivan retroactivamente de misiones completadas.
- Se conservan mision, objetivo, inventario, XP, descubrimientos, combustible,
  condicion, checkpoints, bitacora, posicion y control valido.

## Evidencia automatizada

- Unitarias antes del bloque: 403; candidato antes del cierre documental: 486.
- Movimiento arcade: diez ejecuciones funcionales 10/10. Cinco conservaron
  telemetria detallada: mediana visible 269 ms, 20 km/h 849 ms y 30 km/h
  1123 ms.
- Controles completos: 15/15 en cinco repeticiones del archivo movil.
- Onboarding con touch real: maniobra <15 s, evento <45 s, recompensa <90 s.
- Primeros cinco minutos: 3/3 sesiones de 300 s sobre el runtime
  `59896382b0fbf5f531951907ed19890f6bc9b543`, 0 ms inmovil, cero
  recuperaciones, 11 capturas por sesion y evento/recompensa entre 2099 y
  2275 ms (mediana 2104 ms).
- Garaje: UI real, bloqueado no seleccionable, una solicitud GLB, canvas no
  recreado y persistencia despues de reload.
- PWA: primera instalacion y reload offline del shell, todos los assets del
  manifiesto, red vial, ambos GLB, ciclo de update, mision activa diferida y
  Range 206/1024 sin cache.
- Rendimiento: tres repeticiones; p95 33.4 ms, 0 frames >50/100 ms, camara p95
  1.7 ms (rango 1.7-1.8), RoadTracker p95 0.1 ms (0.1-0.2).
- E2E completo: 65 aprobadas, 57 omitidas y un flake de giro en U reproducido.
  El gesto se corrigio sin ampliar timeouts y el onboarding aprobo luego 3/3;
  la matriz completa se repite antes del push.

## Automatizacion de primeros cinco minutos

Ejecutar con build/preview de produccion:

```bash
npm run capture:arcade-five-minutes -- http://127.0.0.1:4173 artifacts/five-minutes-run-1
```

El runner limpia almacenamiento, usa clicks y touch CDP reales, conduce,
orienta hacia la ruta, escucha la señal y usa reincorporacion visible si hace
falta. Captura 0, 1, 3, 8, 15, 30, 45, 75, 120, 180 y 300 s y escribe
`session.json`. No completa objetivos ni asigna recompensas mediante store.

## Hallazgos de subagentes

Hechos confirmados antes de implementar:

- Profiler: camara/MapLibre/Three y fanout UI eran los costes principales;
  RoadTracker no era cuello de botella.
- Onboarding: narrativa/tutorial/gates podian dejar el primer gesto sin una
  explicacion coherente y el mini navegador competia con controles basicos.
- Experiencia: objetivo 0, penalizacion offroad, flecha parecida al jugador,
  canvas completo para camara y exceso de tarjetas eran los cinco problemas
  principales.
- Regression reviewer: detecto Escape que despausaba tras abrir garaje, stats
  incompletas (audio, combustible offroad, impacto), GLB fuera de PWA y
  readiness prematuro. Tambien detecto fanout de desgaste/audio, precache
  incompleto y avisos de migracion que cubrian acciones. Los P0/P1
  fundamentados se corrigieron y probaron; queda una revision final tras la
  matriz completa.

Inferencias que requieren telefono:

- Que la aceleracion se sienta ligera y no solo rapida.
- Que tamaño de joystick, audio, haptics y camara sean comodos.
- Que el HUD siga legible al sol y que no aparezcan fatiga/mareo/calor.

## Riesgos P2

- Un futuro vehiculo con `modelUrl` diferente necesita reemplazo imperativo y
  disposicion durante el mapa; el candidato actual comparte un unico GLB.
- El garaje tiene semantica modal y Escape seguro, pero falta probar focus trap
  y restauracion en una auditoria dedicada de teclado.
- ETA de routing sigue siendo aproximada; fisica, rango HUD y audio si usan el
  perfil seleccionado.
- La diferencia de FPS throughput frente a la unica corrida baseline debe
  repetirse en telefono aunque no haya frames >50/100 ms.
- La PWA puede reabrir shell, red vial y assets ya precacheados sin conexion,
  pero no promete mapa completo offline: PMTiles y Range se excluyen de forma
  deliberada para no cachear parciales incorrectos.
- Diversion y sensacion de velocidad no se declaran aprobadas por automatizacion.

## Siguiente playtest

Cinco personas sin explicar controles, alternando navegador/PWA. Registrar
tiempo al primer movimiento, errores de reversa, uso espontaneo de
reincorporacion, confusion vehiculo/ruta, carga visual, preferencia de vehiculo,
calor y bateria. Consolidar observaciones antes de assets definitivos o nuevas
misiones.

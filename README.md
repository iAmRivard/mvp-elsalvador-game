# El Salvador: Rutas Perdidas

Videojuego web de conducción y exploración sobre una cartografía estilizada de El Salvador. La
v0.2.3 incluye mapa MapLibre 2.5D autónomo, controles móviles de dos pulgares, corredor vial local,
rutas A* en Web Worker, historia guiada, elección persistente, combustible balanceado, música local,
vehículo y referencias 3D, progreso, Docker y despliegue en Dokploy.

## Requisitos

- Node.js 24 o posterior y npm 11.
- Git LFS para obtener `public/maps/el-salvador.pmtiles` después de clonar.
- Docker para validar la imagen de producción.

## Desarrollo

```sh
git lfs install
git lfs pull
npm ci
npm run dev
```

Abre la dirección que muestra Vite. El mapa permite zoom, rotación, inclinación y navegación táctil.

## Controles del jugador

- `W` o flecha arriba: avanzar.
- `S` o flecha abajo: retroceder.
- `A`/`D` o flechas laterales: girar.
- `Shift`: turbo.
- `R`: recalcular la ruta activa.
- `Escape`: pausar o reanudar.
- `E`: realizar la acción contextual del objetivo cercano.
- `Espacio`: alternativa temporal para la misma interacción.
- En pantallas táctiles aparece joystick de dirección, crucero explícito, freno/reversa, Turbo por
  toque y acción contextual.

Las instalaciones nuevas usan **Joystick + crucero**: `AUTO` comienza apagado y requiere un toque;
Turbo dura 2.5 segundos y luego enfría 1.8 segundos. **Joystick + pedales** y **Botones clásicos**
siguen disponibles sin sobrescribir preferencias existentes. Frenar, pausar, perder foco, cambiar
orientación, abrir un diálogo o iniciar recuperación cancela crucero y Turbo. La bitácora inicia
contraída en teléfonos y reserva espacio para controles tanto en vertical como en horizontal.

El vehículo inicia en San Salvador. La cámara se acerca al detenerse, se abre de forma progresiva
con la velocidad y coloca el vehículo debajo del centro para mostrar más camino por delante. Una
interacción manual de arrastre, zoom, giro o inclinación desactiva el seguimiento; `⌖` realiza un
recentrado suave.

La velocidad del HUD permanece en km/h vehiculares. El desplazamiento geográfico usa una escala de
viaje central de `5`, por lo que los trayectos entre ciudades duran minutos sin mostrar velocidades
absurdas ni multiplicar el consumo de combustible. La aceleración, frenado, reversa y giro son
graduales; la configuración permite elegir dirección **Suave**, **Equilibrada** o **Directa**.

## Vehículo y objetos 3D

En calidad media o alta, Three.js carga de forma diferida un vehículo GLB dentro del contexto WebGL
de MapLibre. La calidad baja, la bandera `VITE_ENABLE_THREE_PLAYER=false` o cualquier error de carga
conservan automáticamente el marcador 2D. Los objetivos interactivos muestran una baliza 3D con
resplandor y pulso; 55 referencias instanciadas agregan árboles, postes, barreras, luces y estaciones
al corredor. Las luces de freno y el polvo offroad responden al movimiento.

Los dos modelos son locales, pesan menos de 40 KiB cada uno y pueden reconstruirse con
`npm run generate:models`. Consulta `docs/architecture/three-layer.md`.

## Inicio, pausa y configuración

La pantalla inicial permite continuar el progreso local o comenzar una partida nueva con
confirmación. La primera expedición muestra un tutorial breve; luego puede repetirse desde la
configuración. Al pausar con `Escape` o `Ⅱ` se puede continuar, guardar, ajustar la presentación o
volver al inicio.

La calidad gráfica, sensibilidad, asistencia vial, movimiento reducido, atmósfera, audio, tutorial
y controles móviles se guardan en este dispositivo, separados del progreso. Preferencias v1 a v4
migran al formato v6 sin perder ajustes. Cambiar la calidad reconstruye el mapa con el perfil
solicitado. Consulta `docs/architecture/interface.md`, `docs/architecture/mobile.md` y
`docs/architecture/audio.md`.

## Ubicaciones y descubrimiento

El mapa incluye catorce lugares entre ciudades, estaciones, pueblos, lagos, playas y volcanes.
Los marcadores dorados están disponibles, los marcadores atenuados requieren un desbloqueo y el
anillo exterior indica que el lugar fue descubierto. Al entrar en el radio de un lugar aparece una
notificación y aumenta el contador del HUD. Las coordenadas y fuentes están documentadas en
`docs/maps/locations.md`.

## Misiones

La bitácora contiene las seis misiones conectadas del capítulo **La señal de Occidente** y la misión
opcional **Señales en Suchitoto**. El recorrido parte de San Salvador, atraviesa un cierre vial,
introduce combustible, inventario y reparación, llega a Santa Ana y termina investigando tres ecos
alrededor de Coatepeque. La siguiente misión principal siempre aparece primero con una acción para
iniciarla o navegar a su comienzo; las opcionales no reemplazan la historia y cada bloqueo explica
su causa. Cada misión valida inicio y prerrequisitos, muestra progreso y calcula una ruta A* local.

Los mensajes normales de radio permanecen en una esquina sin pausar ni bloquear el mapa. La
introducción y final de capítulo, las decisiones, la recuperación y el tutorial obligatorio sí
pausan y lo indican. Historia, misiones, transmisiones y descubrimientos pueden releerse. En
**Camino bloqueado**, las rutas norte y sur cambian A*, consumo y desgaste; tras confirmar aparece
una cuenta `3-2-1` y un temporizador de 4:30. Consulta `docs/gameplay/story-flow.md`,
`docs/gameplay/mission-progression.md` y `docs/gameplay/interactions.md`.

El botón `↻` o la tecla `R` recalculan en un Web Worker; una desviación de 250 m también lo hace con
enfriamiento. La ruta resalta el segmento inmediato y muestra próxima maniobra, flecha y distancia.
La ruta principal usa cian con borde oscuro, el tramo inmediato es claro, el objetivo amarillo y el
fallback naranja discontinuo. Si un objetivo queda fuera del corredor, el fallback no bloquea la
misión. Hay objetivos de llegada, exploración, interacción, recolección, elección, reparación,
combustible y tiempo. Consulta `docs/gameplay/chapter-1.md` y `docs/architecture/routing.md`.

## Red vial local

La v0.2 incluye un corredor transitable derivado de OpenStreetMap entre San Salvador, Santa Tecla,
Santa Ana, Coatepeque y Cerro Verde. El grafo de 5.53 MiB se sirve desde el mismo origen, se precarga
una vez durante la pantalla inicial y usa una cuadrícula para detectar tramos cercanos sin recorrer
la red completa. No existe ninguna consulta a un servicio de rutas externo.

La conducción puntúa distancia, heading, continuidad, ruta activa, arista previa y clase para no
saltar entre calles paralelas. El movimiento geográfico usa subpasos de hasta 10 m para comprobar
agua, bloqueos y objetivos aun con frames lentos. La asistencia predeterminada es suave, conserva
libertad para salir del camino y puede cambiarse a **Libre** o **Firme**.

Para reconstruirlo se requiere `osmium-tool`:

```sh
npm run download:roads
npm run build:roads
npm run check:roads
```

Consulta `docs/architecture/road-network.md` y `docs/maps/road-data.md` para formato, procedencia,
licencia, actualización y limitaciones.

## Progreso y guardado

El HUD muestra nivel, experiencia y energía. La experiencia de las misiones sube de nivel al
alcanzar los umbrales definidos, y la recompensa de Suchitoto aumenta la capacidad de energía. El
HUD también destaca combustible bajo o crítico, objetivos próximos y cada subida de nivel.

La partida se guarda automáticamente en este navegador e incluye posición, combustible, distancia,
condición, inventario, checkpoints, progreso de objetivos, descubrimientos, misiones y recompensas.
El botón `▤` abre el inventario y `▣` permite guardar, cargar o reiniciar con confirmación. Si se
agota el combustible, la condición llega a cero o falla un objetivo con tiempo, se puede reintentar,
volver a un lugar seguro o abandonar la misión. Una condición `0` válida se conserva y abre
recuperación; sólo un campo ausente o inválido migra a `100`. El formato v3 conserva elección y
bitácora, y migra partidas v1/v2 sin reemplazar su combustible. Consulta
`docs/architecture/save-format.md` y `docs/gameplay/progression-systems.md`.

## Audio local

Catorce WAV originales cubren motor, turbo, frenado, terreno, señales y tres estados musicales:
exploración, misión y objetivo cronometrado. Web Audio se desbloquea después de una interacción;
la música cruza pistas en 1.5 s, baja durante la radio y no se reinicia por actualización.
`npm run generate:audio` reconstruye todo de forma determinista. No hay streaming ni solicitudes a
terceros. Consulta `docs/audio/music-system.md`.

## Verificaciones

```sh
npm run check
```

El comando ejecuta lint, typecheck, pruebas, auditoría de recursos externos, validación del mapa,
checksum y build de producción.

La prueba de navegador requiere Chromium de Playwright y cubre escritorio, Pixel 7 vertical y
Pixel 7 horizontal:

```sh
npx playwright install chromium
npm run test:e2e
```

El panel local de métricas se activa solo en desarrollo:

```sh
VITE_ENABLE_DIAGNOSTICS=true npm run dev
```

La validación automática y el protocolo físico pendiente para cinco personas están en
`docs/gameplay/playtest-v0.2.3.md`.

## Docker

```sh
docker build -t el-salvador-rutas-perdidas:v0.2.3 .
docker run --rm -p 8080:80 el-salvador-rutas-perdidas:v0.2.3
curl http://localhost:8080/healthz
```

Después abre `http://localhost:8080`. La guía completa de Dokploy está en
`docs/deployment/dokploy.md`.

## Cartografía

El navegador lee exclusivamente `/maps/el-salvador.pmtiles` y los recursos de `/map-assets`.
Consulta `data/SOURCES.md`, `data/LICENSES.md` y `scripts/maps/README.md` para procedencia,
licencias y reconstrucción.

## Estado de la v0.2.3

- Continuación de historia, recomendación pura, CTA compacto y misiones bloqueadas agrupadas.
- Premisa directa, radio no bloqueante, bitácora por categorías e interacción contextual con `E`.
- Elección norte/sur persistente, rutas A* distintas, consecuencias y timer prominente de 4:30.
- Consumo por distancia geográfica, inicio al 75%, autonomía aproximada y recuperación limitada.
- Tres pistas musicales locales con crossfade, ducking de radio y volumen independiente.
- Migración opcional de controles, cooldown de Turbo preservado y reset vial dentro del juego.
- E2E del flujo narrativo en escritorio, Pixel 7 vertical y horizontal; playtest físico pendiente.

### Base v0.2.2

- Modo móvil recomendado de dos pulgares con AUTO explícito, Turbo temporal y freno cancelable.
- Sprite vacío eliminado, reintento recuperable de MapLibre y caché segura para recursos sin hash.
- Condición `0` válida preservada, reparación de emergencia y desgaste neutral durante carga vial.
- Ruta cian de alto contraste, tooltips de escritorio, cabecera y menú móvil compactos.
- Subpasos geográficos, selección vial por puntuación, continuidad e histéresis.
- Precarga única, métricas, A* en worker, cancelación, timeout, fallback y caché LRU.
- Próxima maniobra, segmento inmediato, flecha de ruta y tutorial progresivo de nueve pasos.
- Diagnóstico de desarrollo y E2E en escritorio, móvil vertical y móvil horizontal.

### Base v0.2

- v0.2 Fase 1: escala de viaje, perfil arcade, sensibilidad y cámara de conducción dinámica.
- v0.2 Fase 2: corredor vial local, generación reproducible, cuadrícula y detección de carretera.
- v0.2 Fase 3: asistencia gradual, superficie, penalización offroad y zonas restringidas.
- v0.2 Fase 4: A* local, sentidos únicos, cierres, caché, recálculo y fallback.
- v0.2 Fase 5: inventario, condición, objetivos funcionales, checkpoints, recuperación y guardado v2.
- v0.2 Fase 6: Capítulo 1 con seis misiones, eventos de radio, audio local, balizas y escenario 3D.
- v0.2 Fase 7: diagnósticos de rendimiento, E2E en tres viewports, Docker, Dokploy y documentación.

- Etapas 1–2: arquitectura, mapa autónomo, estilos y despliegue base.
- Etapa 3: marcador, game loop, movimiento, combustible y seguimiento de cámara.
- Etapa 4: ubicaciones, marcadores interactivos, proximidad y descubrimiento.
- Etapa 5: misiones, rutas, objetivos, interacción y recompensas.
- Etapa 6: nivel, energía, guardado automático, carga, reinicio y migración.
- Etapa 7: controles táctiles, layouts vertical/horizontal y perfil gráfico adaptativo.
- Etapa 8: pantalla inicial, tutorial, pausa, ajustes persistentes, animaciones e indicadores.
- Etapa 9: Three.js diferido, vehículo GLB, balizas, escenario instanciado y fallback 2D.
- Etapa 10: endurecimiento del despliegue, diagnósticos y validación de producción.

Consulta `docs/architecture/routing.md`, `docs/gameplay/vehicle-handling.md`,
`docs/gameplay/progression-systems.md` y `docs/architecture/performance.md` para el núcleo actual.

No se incluyen backend, autenticación, multijugador, routing externo ni terreno 3D.

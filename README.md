# El Salvador: Rutas Perdidas

Videojuego web de conducción y exploración sobre una cartografía estilizada de El Salvador. La
v0.2 incluye mapa MapLibre 2.5D autónomo, corredor vial local, rutas A*, vehículo y referencias 3D,
seis misiones conectadas, inventario, recuperación, audio local, progreso persistente, adaptación
móvil, Docker y documentación de despliegue.

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
- `Escape`: pausar o reanudar.
- `Espacio`: realizar la acción del objetivo cercano.
- En pantallas táctiles aparecen una cruceta, turbo y accesos para investigar, centrar y pausar.

En teléfonos, las acciones táctiles se organizan en dos filas para evitar cruces con la cruceta. La
bitácora inicia contraída y puede expandirse; el layout también tiene una variante horizontal. El
perfil gráfico adapta antialias, densidad de píxeles, cámara y frecuencia de rutas según el hardware.

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

La calidad gráfica, sensibilidad de dirección, asistencia vial, movimiento reducido, atmósfera,
audio y estado del tutorial se guardan en este dispositivo, separados del progreso. Hay controles
de volumen general y efectos, silencio y reducción de efectos intensos. Cambiar la calidad
reconstruye el mapa con el perfil solicitado. Consulta `docs/architecture/interface.md` y
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
alrededor de Coatepeque. Cada misión valida inicio y prerrequisitos, muestra progreso y calcula con
A* una ruta sobre carreteras locales.

El botón `↻` o la tecla `R` recalculan; una desviación de 250 m también lo hace con enfriamiento. Si
un objetivo queda fuera del corredor, una línea discontinua actúa como fallback sin bloquear la
misión. Hay objetivos de llegada, exploración, interacción, recolección, elección, reparación,
combustible y tiempo. El final revela una nueva señal y desbloquea Cerro Verde. Consulta
`docs/gameplay/chapter-1.md`.

## Red vial local

La v0.2 incluye un corredor transitable derivado de OpenStreetMap entre San Salvador, Santa Tecla,
Santa Ana, Coatepeque y Cerro Verde. El grafo de 5.53 MiB se sirve desde el mismo origen, se carga
bajo demanda y usa una cuadrícula para detectar tramos cercanos sin recorrer la red completa. No
existe ninguna consulta a un servicio de rutas externo.

La conducción detecta la clase de vía a 10 Hz y aplica límites de velocidad y combustible. La
asistencia predeterminada es suave, conserva libertad para salir del camino y aumenta ligeramente
en táctil; puede cambiarse a **Libre** o **Firme** en configuración. El HUD identifica terreno
difícil y los polígonos locales impiden atravesar Coatepeque, otros lagos grandes y el océano.

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
volver a un lugar seguro o abandonar la misión. El formato v2 migra partidas anteriores; consulta
`docs/architecture/save-format.md` y `docs/gameplay/progression-systems.md`.

## Audio local

Diez WAV originales cubren motor, turbo, frenado, terreno, misiones, descubrimientos, combustible e
interferencia. Web Audio se desbloquea únicamente después de una interacción; los bucles de motor
se mezclan de forma continua y no se reinician por frame. `npm run generate:audio` reconstruye los
archivos de forma determinista. No hay streaming ni solicitudes a terceros.

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

## Docker

```sh
docker build -t el-salvador-rutas-perdidas .
docker run --rm -p 8080:80 el-salvador-rutas-perdidas
curl http://localhost:8080/healthz
```

Después abre `http://localhost:8080`. La guía completa de Dokploy está en
`docs/deployment/dokploy.md`.

## Cartografía

El navegador lee exclusivamente `/maps/el-salvador.pmtiles` y los recursos de `/map-assets`.
Consulta `data/SOURCES.md`, `data/LICENSES.md` y `scripts/maps/README.md` para procedencia,
licencias y reconstrucción.

## Estado de la v0.2

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

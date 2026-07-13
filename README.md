# El Salvador: Rutas Perdidas

Videojuego web de exploración sobre una cartografía estilizada de El Salvador. Esta base implementa
las etapas 1 a 9: SPA React/TypeScript, mapa MapLibre 2.5D, PMTiles local, vehículo 3D,
ubicaciones, misiones, progreso persistente, adaptación móvil, interfaz visual completa y recursos
autocontenidos, validaciones, Docker y documentación de despliegue.

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
- `Espacio`: investigar un objetivo interactivo cercano.
- En pantallas táctiles aparecen una cruceta, turbo y accesos para investigar, centrar y pausar.

En teléfonos, las acciones táctiles se organizan en dos filas para evitar cruces con la cruceta. La
bitácora inicia contraída y puede expandirse; el layout también tiene una variante horizontal. El
perfil gráfico adapta antialias, densidad de píxeles, cámara y frecuencia de rutas según el hardware.

El vehículo inicia en San Salvador. La cámara lo sigue hasta que el usuario arrastra el mapa o
desactiva el seguimiento desde `⌖`.

## Vehículo y objetos 3D

En calidad media o alta, Three.js carga de forma diferida un vehículo GLB dentro del contexto WebGL
de MapLibre. La calidad baja, la bandera `VITE_ENABLE_THREE_PLAYER=false` o cualquier error de carga
conservan automáticamente el marcador 2D. Iniciar **Señales en Suchitoto** muestra además una baliza
3D que responde a la proximidad y se investiga con `Espacio` o el control táctil.

Los dos modelos son locales, pesan menos de 40 KiB cada uno y pueden reconstruirse con
`npm run generate:models`. Consulta `docs/architecture/three-layer.md`.

## Inicio, pausa y configuración

La pantalla inicial permite continuar el progreso local o comenzar una partida nueva con
confirmación. La primera expedición muestra un tutorial breve; luego puede repetirse desde la
configuración. Al pausar con `Escape` o `Ⅱ` se puede continuar, guardar, ajustar la presentación o
volver al inicio.

La calidad gráfica, el movimiento reducido, la atmósfera del mapa y el estado del tutorial se
guardan en este dispositivo, separados del progreso. Cambiar la calidad reconstruye el mapa con el
perfil solicitado. La atmósfera es decorativa y se puede desactivar; no oculta objetivos ni datos
necesarios para jugar. Consulta `docs/architecture/interface.md`.

## Ubicaciones y descubrimiento

El mapa incluye doce lugares iniciales entre ciudades, pueblos, lagos, playas, bosques y volcanes.
Los marcadores dorados están disponibles, los marcadores atenuados requieren un desbloqueo y el
anillo exterior indica que el lugar fue descubierto. Al entrar en el radio de un lugar aparece una
notificación y aumenta el contador del HUD. Las coordenadas y fuentes están documentadas en
`docs/maps/locations.md`.

## Misiones

La bitácora permite iniciar y abandonar tres misiones. Cada misión valida su lugar de inicio y sus
prerrequisitos, muestra distancia y objetivos, y dibuja una ruta directa al siguiente punto. Los
objetivos se completan por proximidad; la señal de Suchitoto requiere además `Espacio` o el botón
**Investigar**. Las recompensas incluyen experiencia, combustible, energía, objetos, historia y el
desbloqueo de Volcán de Santa Ana o Cerro Verde.

## Progreso y guardado

El HUD muestra nivel, experiencia y energía. La experiencia de las misiones sube de nivel al
alcanzar los umbrales definidos, y la recompensa de Suchitoto aumenta la capacidad de energía. El
HUD también destaca combustible bajo o crítico, objetivos próximos y cada subida de nivel.

La partida se guarda automáticamente en este navegador e incluye posición, combustible, distancia,
descubrimientos, misiones y recompensas. El botón `▣` de la barra superior permite guardar ahora,
cargar el último estado o reiniciar con confirmación. El formato está versionado y valida los datos
antes de cargarlos; consulta `docs/architecture/save-format.md`.

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

## Estado y siguientes etapas

- Etapas 1–2: arquitectura, mapa autónomo, estilos y despliegue base.
- Etapa 3: marcador, game loop, movimiento, combustible y seguimiento de cámara.
- Etapa 4: ubicaciones, marcadores interactivos, proximidad y descubrimiento.
- Etapa 5: tres misiones, rutas, objetivos, interacción y recompensas.
- Etapa 6: nivel, energía, guardado automático, carga, reinicio y migración.
- Etapa 7: controles táctiles, layouts vertical/horizontal y perfil gráfico adaptativo.
- Etapa 8: pantalla inicial, tutorial, pausa, ajustes persistentes, animaciones e indicadores.
- Etapa 9: Three.js diferido, vehículo GLB, baliza interactiva y fallback 2D.
- Etapa 10: endurecimiento final del despliegue y prueba completa del contenedor.

No se incluyen backend, autenticación, multijugador, routing externo ni terreno 3D.

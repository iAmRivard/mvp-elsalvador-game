# Proyecto: El Salvador — Rutas Perdidas

Actúa como arquitecto de software, coordinador técnico y desarrollador senior especializado en videojuegos web, TypeScript, React, WebGL, MapLibre GL JS, procesamiento de datos geográficos, Docker y despliegues en Dokploy.

Debes diseñar y construir un videojuego web de exploración basado en una versión estilizada del mapa real de El Salvador.

El nombre provisional del proyecto es:

# El Salvador: Rutas Perdidas

El objetivo es desarrollar un MVP funcional, atractivo, extensible y completamente desplegable mediante Docker.

La aplicación debe funcionar en producción sin depender de proveedores externos de mapas, APIs geográficas de terceros, CDNs o recursos alojados fuera del dominio donde se despliegue el juego.

---

# 1. Concepto del juego

El jugador podrá explorar El Salvador utilizando:

* Carreteras reales.
* Ciudades.
* Municipios.
* Departamentos.
* Lagos.
* Volcanes.
* Playas.
* Zonas rurales.
* Puntos de interés.
* Lugares turísticos.
* Elementos ficticios agregados para la historia.

El mapa real servirá como base, pero la experiencia debe sentirse como un videojuego de aventura y exploración, no como una aplicación tradicional de navegación.

El juego tendrá inicialmente una vista 2.5D con cámara inclinada.

El jugador será representado al principio por:

* Un marcador estilizado.
* Un vehículo sencillo.
* Una motocicleta.
* O un modelo 3D liviano.

La primera versión puede comenzar con un marcador 2D, pero la arquitectura debe permitir reemplazarlo posteriormente por un modelo 3D.

---

# 2. Historia inicial

Después de un evento desconocido, distintas señales comienzan a aparecer en diferentes partes de El Salvador.

El jugador debe recorrer el país, investigar puntos misteriosos, encontrar objetos, descubrir nuevas regiones y completar misiones.

La historia debe aprovechar lugares reales, pero puede utilizar nombres ficticios o variaciones creativas cuando sea conveniente.

Ejemplos de elementos narrativos:

* Señales desconocidas.
* Zonas bloqueadas.
* Carreteras abandonadas.
* Estaciones de combustible.
* Torres de comunicación.
* Refugios.
* Objetos escondidos.
* Volcanes con actividad extraña.
* Pueblos incomunicados.
* Eventos climáticos.
* Leyendas salvadoreñas reinterpretadas.

---

# 3. Objetivo del MVP

El MVP debe permitir:

1. Mostrar el mapa completo de El Salvador.
2. Explorar el mapa mediante zoom, rotación e inclinación.
3. Controlar un jugador o vehículo.
4. Moverse usando teclado.
5. Moverse usando controles táctiles.
6. Hacer que la cámara siga al jugador.
7. Mostrar ciudades y puntos de interés.
8. Mostrar al menos tres misiones.
9. Iniciar y completar misiones.
10. Calcular distancias geográficas.
11. Consumir combustible y energía.
12. Ganar experiencia.
13. Descubrir ubicaciones.
14. Guardar el progreso localmente.
15. Cargar automáticamente la partida.
16. Reiniciar el progreso.
17. Funcionar en computadora y dispositivos móviles.
18. Funcionar sin servicios externos de mapas.
19. Ejecutarse completamente mediante Docker.
20. Estar listo para desplegarse en Dokploy.

---

# 4. Tecnologías principales

Utiliza preferiblemente:

* Vite.
* React.
* TypeScript.
* MapLibre GL JS.
* PMTiles.
* Zustand.
* Turf.js.
* Vitest.
* Playwright.
* ESLint.
* Prettier.
* Nginx.
* Docker.
* GitHub Actions.

Three.js puede utilizarse posteriormente para:

* Vehículos.
* Personajes.
* Cofres.
* Enemigos.
* Monumentos.
* Torres.
* Señales.
* Elementos interactivos.

No utilizar Three.js para renderizar el mapa completo.

No agregar backend en el MVP salvo que exista una necesidad técnica real y justificada.

No agregar todavía:

* Multijugador.
* Autenticación.
* PostgreSQL.
* PostGIS.
* Redis.
* Chat.
* Ranking global.
* Economía en línea.
* Sincronización en la nube.
* OSRM o Valhalla en producción.
* Inteligencia artificial generativa en tiempo de ejecución.

---

# 5. Principio de autonomía

La aplicación debe ser autónoma durante su ejecución.

Una vez desplegada, no debe depender de:

* Mapbox.
* MapTiler.
* Google Maps.
* Google Maps Tiles.
* Cesium Ion.
* Servidores públicos de OpenStreetMap.
* APIs externas de rutas.
* APIs externas de elevación.
* APIs externas de geocodificación.
* CDNs de JavaScript.
* CDNs de CSS.
* CDNs de fuentes.
* CDNs de iconos.
* CDNs de sprites.
* Modelos 3D alojados externamente.
* Imágenes alojadas externamente.
* Archivos GeoJSON remotos.
* Estilos de mapas remotos.

Las únicas solicitudes de red permitidas durante la ejecución normal del MVP deben apuntar al mismo dominio donde se encuentre desplegado el juego.

Ejemplo:

```text
https://juego.rivasystems.dev/
https://juego.rivasystems.dev/maps/el-salvador.pmtiles
https://juego.rivasystems.dev/map-assets/styles/el-salvador.json
https://juego.rivasystems.dev/map-assets/fonts/
https://juego.rivasystems.dev/map-assets/sprites/
https://juego.rivasystems.dev/models/
```

Las dependencias de npm pueden descargarse durante la compilación, pero la aplicación final debe ejecutarse sin descargar recursos externos.

---

# 6. Uso de datos geográficos

Utiliza datos abiertos como base para construir el mapa de El Salvador.

La aplicación debe utilizar en producción un archivo local:

```text
public/maps/el-salvador.pmtiles
```

El archivo PMTiles debe contener únicamente las capas necesarias para el juego.

Priorizar:

* Carreteras principales.
* Carreteras secundarias.
* Calles.
* Límites administrativos.
* Áreas urbanas.
* Agua.
* Ríos.
* Lagos.
* Parques.
* Bosques.
* Nombres de ciudades.
* Nombres de municipios.
* Edificios únicamente cuando aporten valor.
* Puntos de interés relevantes.

No incluir información innecesaria que aumente demasiado el tamaño del mapa.

Debe existir una configuración central:

```ts
export interface MapSourceConfig {
  archiveUrl: string;
  styleUrl: string;
  attribution: string;
  minZoom: number;
  maxZoom: number;
}

export const mapSourceConfig: MapSourceConfig = {
  archiveUrl: "/maps/el-salvador.pmtiles",
  styleUrl: "/map-assets/styles/el-salvador.json",
  attribution: "© OpenStreetMap contributors",
  minZoom: 7,
  maxZoom: 16
};
```

No utilizar URLs externas como valores predeterminados.

---

# 7. Recursos cartográficos locales

Todos los recursos requeridos por MapLibre deben quedar almacenados dentro del proyecto.

Incluir:

```text
public/
├── maps/
│   └── el-salvador.pmtiles
├── map-assets/
│   ├── styles/
│   │   └── el-salvador.json
│   ├── fonts/
│   ├── sprites/
│   ├── icons/
│   └── textures/
├── geojson/
├── models/
└── audio/
```

El estilo de MapLibre debe usar rutas locales.

Ejemplo:

```json
{
  "sprite": "/map-assets/sprites/basemap",
  "glyphs": "/map-assets/fonts/{fontstack}/{range}.pbf"
}
```

No deben existir referencias externas en:

* `index.html`.
* Archivos CSS.
* Archivos JSON de estilo.
* Configuración de MapLibre.
* Archivos GeoJSON.
* Modelos GLTF o GLB.
* Archivos de misiones.
* Archivos de ubicaciones.
* Configuración del juego.

---

# 8. Archivos grandes y Git

El objetivo es que el repositorio contenga todo lo necesario para construir y desplegar el juego.

Antes de agregar archivos geográficos:

1. Verificar el tamaño del archivo.
2. Evitar guardar varias copias del mismo mapa.
3. Evitar almacenar archivos temporales.
4. Mantener únicamente el artefacto final requerido por producción.
5. Utilizar Git LFS cuando el archivo sea demasiado grande para Git normal.
6. Verificar que Docker reciba el archivo real y no un puntero de Git LFS.
7. Documentar cómo instalar Git LFS.
8. Configurar GitHub Actions para descargar archivos LFS.

No almacenar simultáneamente en el historial principal:

* El archivo `.osm.pbf`.
* El archivo `.mbtiles`.
* El archivo `.pmtiles`.
* Un GeoPackage con la misma información.
* Archivos temporales de Planetiler.

El repositorio debe contener preferiblemente:

```text
public/maps/el-salvador.pmtiles
```

Los datos fuente pesados pueden descargarse únicamente al ejecutar un script de reconstrucción.

---

# 9. Reproducibilidad del mapa

Además del archivo PMTiles final, el repositorio debe contener scripts para reconstruirlo.

Crear:

```text
scripts/maps/
├── download-source.sh
├── build-map.sh
├── validate-map.sh
├── generate-checksum.sh
└── README.md
```

Los scripts deben:

* Descargar el extracto geográfico de El Salvador.
* Validar que la fuente exista.
* Generar el mapa.
* Limitar el área geográfica.
* Seleccionar las capas necesarias.
* Crear el archivo PMTiles.
* Generar un checksum SHA-256.
* Mostrar el tamaño final.
* Registrar la fecha de generación.
* Fallar claramente cuando ocurra un error.

No es necesario ejecutar la generación completa del mapa en cada compilación de Docker.

El archivo final debe estar previamente generado y versionado.

---

# 10. Documentación de fuentes y licencias

Crear:

```text
data/
├── SOURCES.md
├── LICENSES.md
├── checksums.txt
└── MAP_VERSION.md
```

Documentar:

* Fuente de los datos.
* Fecha de extracción.
* Fecha de generación.
* Licencia.
* Atribución requerida.
* Bounding box.
* Capas incluidas.
* Niveles de zoom.
* Herramienta utilizada.
* Comandos ejecutados.
* Tamaño del archivo.
* SHA-256.
* Modificaciones aplicadas.

Mostrar permanentemente la atribución correspondiente dentro del mapa.

No ocultar ni eliminar las atribuciones.

---

# 11. Terreno y elevación

El terreno 3D no debe bloquear el MVP.

Implementar primero:

1. Mapa vectorial local.
2. Cámara inclinada.
3. Hillshade, cuando esté disponible.
4. Movimiento.
5. Misiones.
6. Progreso.
7. Diseño visual.
8. Modelos 3D.
9. Elevación local.

Crear una bandera:

```env
VITE_ENABLE_TERRAIN=false
```

El juego debe funcionar correctamente cuando el terreno esté desactivado.

Si se incorpora terreno posteriormente:

* Los datos deben almacenarse localmente.
* No depender de APIs externas.
* Documentar cómo se generaron.
* Mantener un fallback sin elevación.
* Limitar niveles de zoom.
* Comprimir y optimizar los datos.
* No generar un archivo excesivamente grande sin justificación.

---

# 12. Estilo visual

El juego debe tener una estética estilizada, moderna y ligeramente misteriosa.

Características:

* Colores naturales.
* Agua claramente diferenciada.
* Carreteras visibles.
* Zonas urbanas simplificadas.
* Terreno ligeramente sombreado.
* Cámara inclinada.
* Marcadores animados.
* Paneles semitransparentes.
* Interfaz limpia.
* Tipografía local.
* Diseño responsive.
* Animaciones moderadas.
* Indicadores de misión.
* Efectos visuales ligeros.
* Niebla de guerra opcional.

No debe parecer Google Maps ni una aplicación GIS tradicional.

El mapa debe ser el elemento principal de la pantalla.

---

# 13. Interfaz del juego

## Barra superior

Mostrar:

* Nombre del juego.
* Nombre de la región actual.
* Botón de pausa.
* Botón de configuración.
* Botón para reiniciar la partida.

## Estado del jugador

Mostrar:

* Nivel.
* Experiencia.
* Energía.
* Combustible.
* Velocidad.
* Distancia recorrida.
* Ubicación actual.

## Panel de misión

Mostrar:

* Nombre de la misión.
* Descripción.
* Objetivo.
* Lugar de destino.
* Distancia restante.
* Recompensa.
* Estado.
* Botón para iniciar.
* Botón para abandonar.

## Controles del mapa

Incluir:

* Acercar.
* Alejar.
* Rotar.
* Cambiar inclinación.
* Centrar cámara en el jugador.
* Activar o desactivar seguimiento.

## Controles móviles

Incluir:

* Joystick virtual o botones direccionales.
* Botón de interacción.
* Botón de aceleración.
* Botón para centrar la cámara.
* Botón de pausa.

Evitar que el navegador haga scroll mientras se utilizan los controles.

---

# 14. Movimiento del jugador

Controles de teclado:

* `W` o flecha arriba: avanzar.
* `S` o flecha abajo: retroceder.
* `A` o flecha izquierda: girar.
* `D` o flecha derecha: girar.
* `Shift`: acelerar.
* `Espacio`: interactuar.
* `Escape`: pausar.

El movimiento debe:

* Utilizar longitud y latitud.
* Ser independiente de los FPS.
* Utilizar delta time.
* Tener aceleración gradual.
* Tener desaceleración.
* Consumir combustible.
* Actualizar el heading.
* Impedir velocidades inválidas.
* Mantener al jugador dentro del área permitida.
* Evitar actualizar React state en cada frame.

Crear una función similar a:

```ts
interface MovePlayerInput {
  longitude: number;
  latitude: number;
  heading: number;
  speedMetersPerSecond: number;
  deltaTimeSeconds: number;
}

interface MovePlayerResult {
  longitude: number;
  latitude: number;
  heading: number;
  distanceMeters: number;
}

export function movePlayer(
  input: MovePlayerInput
): MovePlayerResult;
```

Utilizar `requestAnimationFrame` para el game loop.

La cámara debe seguir al jugador suavemente.

No guardar la posición del jugador en un estado que provoque un render completo de React en cada frame.

---

# 15. Ubicaciones iniciales

Crear un archivo:

```text
src/data/locations.ts
```

Incluir al menos:

* San Salvador.
* Santa Ana.
* San Miguel.
* Santa Tecla.
* Suchitoto.
* El Tunco.
* Lago de Coatepeque.
* Lago de Ilopango.
* Volcán de Santa Ana.
* Volcán de San Salvador.
* Cerro Verde.
* Volcán de Conchagua.

Utilizar una estructura como:

```ts
export interface GameLocation {
  id: string;
  name: string;
  type:
    | "city"
    | "town"
    | "volcano"
    | "lake"
    | "beach"
    | "forest"
    | "ruin"
    | "station";
  coordinates: [number, number];
  discoveryRadiusMeters: number;
  description: string;
  initiallyUnlocked: boolean;
}
```

Verificar las coordenadas antes de incorporarlas definitivamente.

---

# 16. Misiones iniciales

Crear al menos tres misiones.

## Misión 1: Camino hacia Santa Ana

Inicio:

* San Salvador.

Destino:

* Santa Ana.

Objetivo:

* Llegar a Santa Ana sin quedarse sin combustible.

Recompensa:

* Experiencia.
* Combustible.
* Desbloqueo del Volcán de Santa Ana.

## Misión 2: El secreto de Coatepeque

Inicio:

* Santa Ana.

Destino:

* Lago de Coatepeque.

Objetivo:

* Encontrar tres puntos de exploración alrededor del lago.

Recompensa:

* Objeto especial.
* Experiencia.
* Nueva región desbloqueada.

## Misión 3: Señales en Suchitoto

Inicio:

* San Salvador.

Destino:

* Suchitoto.

Objetivo:

* Investigar una señal misteriosa.

Recompensa:

* Aumento de energía.
* Experiencia.
* Desbloqueo de una nueva parte de la historia.

Las misiones deben estar definidas fuera de los componentes.

Crear:

```text
src/data/missions.ts
```

Definir una interfaz similar a:

```ts
export interface Mission {
  id: string;
  title: string;
  description: string;
  startLocationId: string;
  destinationLocationId: string;
  objectives: MissionObjective[];
  rewards: MissionReward[];
  prerequisites: string[];
}
```

---

# 17. Estado global

Utilizar Zustand.

Crear una interfaz base:

```ts
export interface GameState {
  playerPosition: {
    longitude: number;
    latitude: number;
  };
  heading: number;
  speed: number;
  fuel: number;
  energy: number;
  level: number;
  experience: number;
  totalDistanceMeters: number;
  activeMissionId: string | null;
  completedMissionIds: string[];
  discoveredLocationIds: string[];
  unlockedLocationIds: string[];
  isPaused: boolean;
}
```

Crear acciones para:

* Guardar partida.
* Cargar partida.
* Reiniciar partida.
* Mover jugador.
* Consumir combustible.
* Restaurar combustible.
* Consumir energía.
* Agregar experiencia.
* Subir de nivel.
* Iniciar misión.
* Abandonar misión.
* Completar misión.
* Descubrir ubicación.
* Desbloquear región.
* Pausar.
* Reanudar.

Guardar el progreso usando localStorage o IndexedDB.

Agregar una versión al formato de guardado para permitir migraciones futuras.

---

# 18. Rutas y distancias

Utilizar Turf.js inicialmente para:

* Calcular distancia.
* Detectar proximidad.
* Saber si el jugador llegó a un destino.
* Verificar descubrimientos.
* Dibujar líneas simples.
* Calcular puntos intermedios.

No depender todavía de un servicio externo de rutas.

Crear una abstracción:

```ts
export interface RouteResult {
  coordinates: [number, number][];
  distanceMeters: number;
  estimatedDurationSeconds?: number;
}

export interface RoutingService {
  getRoute(
    origin: [number, number],
    destination: [number, number]
  ): Promise<RouteResult>;
}
```

La primera implementación puede dibujar una línea sencilla.

La arquitectura debe permitir conectar posteriormente:

* OSRM autohospedado.
* Valhalla autohospedado.
* GraphHopper autohospedado.

No incorporar estos servicios durante el MVP.

---

# 19. Estructura recomendada

```text
.
├── public/
│   ├── maps/
│   │   └── el-salvador.pmtiles
│   ├── map-assets/
│   │   ├── styles/
│   │   ├── fonts/
│   │   ├── sprites/
│   │   ├── icons/
│   │   └── textures/
│   ├── geojson/
│   ├── models/
│   ├── audio/
│   └── images/
├── src/
│   ├── app/
│   │   └── App.tsx
│   ├── components/
│   │   ├── game/
│   │   ├── hud/
│   │   ├── map/
│   │   └── common/
│   ├── config/
│   │   ├── game.config.ts
│   │   └── map.config.ts
│   ├── data/
│   │   ├── locations.ts
│   │   └── missions.ts
│   ├── game/
│   │   ├── gameLoop.ts
│   │   ├── movement.ts
│   │   ├── progression.ts
│   │   ├── missions.ts
│   │   ├── discovery.ts
│   │   └── camera.ts
│   ├── map/
│   │   ├── mapService.ts
│   │   ├── routingService.ts
│   │   ├── pmtilesProtocol.ts
│   │   └── threeLayer.ts
│   ├── store/
│   │   └── gameStore.ts
│   ├── types/
│   ├── utils/
│   └── styles/
├── scripts/
│   └── maps/
├── data/
├── docs/
│   ├── architecture/
│   ├── maps/
│   ├── deployment/
│   └── adr/
├── nginx/
│   └── default.conf
├── tests/
├── Dockerfile
├── .dockerignore
├── .env.example
├── package.json
├── README.md
└── LICENSE
```

Puedes ajustar la estructura cuando exista una justificación técnica clara.

---

# 20. Uso de subagentes

Puedes utilizar subagentes cuando el entorno lo permita.

El agente principal debe actuar como coordinador y conservar la responsabilidad final sobre:

* Arquitectura.
* División del trabajo.
* Integración.
* Resolución de conflictos.
* Revisión de código.
* Compilación.
* Pruebas.
* Seguridad.
* Documentación.
* Despliegue.

## Modelos para subagentes

No es necesario utilizar modelos de máxima capacidad para todos los subagentes.

Utiliza modelos pequeños, rápidos o económicos para tareas rutinarias y bien delimitadas.

Los modelos más potentes deben reservarse para:

* Decisiones arquitectónicas.
* Problemas difíciles de integración.
* Errores complejos.
* Diseño del game loop.
* Integración MapLibre y Three.js.
* Problemas de rendimiento WebGL.
* Revisión final.
* Migraciones o cambios estructurales.
* Resolución de conflictos entre implementaciones.

Los modelos pequeños o económicos pueden encargarse de:

* Crear tipos TypeScript.
* Escribir pruebas unitarias sencillas.
* Crear documentación.
* Revisar rutas de archivos.
* Preparar configuraciones.
* Crear componentes presentacionales.
* Verificar atribuciones.
* Revisar URLs externas.
* Crear scripts sencillos.
* Generar datos estáticos.
* Revisar lint.
* Corregir formato.
* Crear ejemplos de variables de entorno.
* Actualizar el README.
* Preparar archivos JSON.
* Revisar accesibilidad básica.

No utilizar un modelo potente cuando una tarea pueda resolverse correctamente con un modelo más pequeño.

## Subagentes sugeridos

### 1. Subagente de datos geográficos

Responsabilidades:

* Preparar el archivo PMTiles.
* Validar capas.
* Validar nombres.
* Preparar estilos.
* Preparar sprites.
* Preparar fuentes.
* Documentar fuentes y licencias.
* Crear scripts de reconstrucción.

Modelo sugerido:

* Pequeño o intermedio para documentación, validaciones y scripts.
* Escalar al agente principal únicamente cuando haya problemas cartográficos complejos.

### 2. Subagente de frontend y MapLibre

Responsabilidades:

* Crear componentes del mapa.
* Configurar el protocolo PMTiles.
* Implementar controles.
* Implementar marcadores.
* Implementar cámara.
* Configurar capas.

Modelo sugerido:

* Intermedio.
* Utilizar un modelo más potente solamente para problemas complejos de WebGL, proyecciones o integración.

### 3. Subagente de jugabilidad

Responsabilidades:

* Movimiento.
* Game loop.
* Combustible.
* Energía.
* Misiones.
* Descubrimiento.
* Progreso.
* Guardado local.

Modelo sugerido:

* Intermedio.
* El agente principal debe revisar la lógica crítica.

### 4. Subagente de interfaz

Responsabilidades:

* HUD.
* Panel de misión.
* Controles móviles.
* Diseño responsive.
* Accesibilidad.
* Menú de pausa.
* Pantalla inicial.

Modelo sugerido:

* Pequeño o intermedio.

### 5. Subagente de DevOps

Responsabilidades:

* Dockerfile.
* Nginx.
* GitHub Actions.
* Health checks.
* Documentación para Dokploy.
* Verificación de Git LFS.
* Comprobaciones de la imagen Docker.

Modelo sugerido:

* Pequeño o intermedio para configuraciones conocidas.
* Escalar al agente principal si existen errores de infraestructura difíciles.

### 6. Subagente de calidad

Responsabilidades:

* Typecheck.
* Lint.
* Pruebas.
* Build.
* Detección de URLs externas.
* Revisión de licencias.
* Revisión de archivos faltantes.
* Pruebas del contenedor.

Modelo sugerido:

* Pequeño.

---

# 21. Reglas para subagentes

Los subagentes deben cumplir estas reglas:

1. Recibir tareas concretas y verificables.
2. No modificar simultáneamente los mismos archivos.
3. No cambiar la arquitectura sin autorización del agente principal.
4. No agregar dependencias sin justificarlo.
5. No integrar directamente cambios en la rama principal.
6. No eliminar pruebas para hacer pasar el pipeline.
7. No ocultar errores mediante `any`.
8. No dejar funciones vacías.
9. No escribir pseudocódigo como implementación final.
10. No dejar TODO críticos.
11. Documentar decisiones importantes.
12. Ejecutar pruebas relacionadas con sus cambios.
13. Entregar un resumen de los archivos modificados.
14. Informar limitaciones o dudas.
15. Escalar al agente principal cuando la tarea exceda su alcance.

Cuando el entorno permita ramas o worktrees:

* Cada subagente debe trabajar en una rama o worktree separado.
* El agente principal debe revisar el diff.
* El agente principal debe integrar los cambios.
* Después de integrar, ejecutar todas las verificaciones.

No utilizar demasiados subagentes simultáneamente.

Limitar la concurrencia para evitar:

* Conflictos.
* Duplicación de trabajo.
* Decisiones incompatibles.
* Consumo innecesario de recursos.
* Cambios descoordinados.

Utilizar normalmente entre dos y cuatro subagentes activos.

---

# 22. Registro de decisiones

Guardar las decisiones importantes dentro del repositorio.

Crear documentos ADR en:

```text
docs/adr/
```

Ejemplos:

```text
0001-use-maplibre.md
0002-use-pmtiles.md
0003-no-backend-in-mvp.md
0004-runtime-autonomy.md
0005-dokploy-docker-deployment.md
```

Cada ADR debe explicar:

* Contexto.
* Decisión.
* Alternativas consideradas.
* Consecuencias.
* Estado.

No dejar información importante únicamente en mensajes o respuestas de los agentes.

---

# 23. Verificación de recursos externos

Crear una validación automática que detecte URLs externas inesperadas.

Revisar:

* TypeScript.
* JavaScript.
* CSS.
* HTML.
* JSON.
* Estilos MapLibre.
* GeoJSON.
* Modelos GLTF.
* Configuración.
* Archivos de documentación técnica cuando sea necesario.

La validación debe detectar:

```text
http://
https://
//
```

Debe permitir excepciones únicamente para:

* Atribuciones textuales.
* Documentación.
* Enlaces de licencias.
* Fuentes utilizadas por los scripts de generación.
* Recursos explícitamente permitidos durante desarrollo.

No debe permitir recursos externos en tiempo de ejecución.

Crear una prueba end-to-end que:

1. Inicie el contenedor.
2. Abra el juego.
3. Bloquee solicitudes a dominios de terceros.
4. Espere a que cargue el mapa.
5. Mueva al jugador.
6. Abra una misión.
7. Verifique que no existan errores críticos.
8. Verifique que no existan solicitudes externas.

---

# 24. Rendimiento

La aplicación debe funcionar razonablemente en computadoras y teléfonos de gama media.

Aplicar:

* `requestAnimationFrame`.
* Delta time.
* Lazy loading.
* Code splitting.
* Carga diferida de modelos.
* Modelos GLB livianos.
* Texturas comprimidas.
* Reducción de renders.
* Limpieza de listeners.
* Limpieza de recursos WebGL.
* Límites de objetos visibles.
* Memoización únicamente cuando sea útil.
* Actualizaciones controladas de Zustand.
* No actualizar React state en cada frame.
* No recalcular rutas sin necesidad.
* No guardar localStorage en cada frame.
* Throttling del guardado automático.
* Reducción de capas cartográficas innecesarias.

Agregar una configuración de calidad:

```ts
export type GraphicsQuality = "low" | "medium" | "high";
```

Permitir modificar:

* Sombras.
* Animaciones.
* Densidad de objetos.
* Inclinación.
* Terreno.
* Distancia de renderizado.
* Efectos visuales.

---

# 25. Accesibilidad

Incluir:

* Botones con etiquetas accesibles.
* Navegación por teclado.
* Textos legibles.
* Contraste suficiente.
* Indicadores que no dependan únicamente del color.
* Configuración de sensibilidad.
* Opción de reducir animaciones.
* Advertencia cuando WebGL no esté disponible.
* Controles táctiles suficientemente grandes.
* Estado visible de pausa.
* Mensajes de error comprensibles.

---

# 26. Docker

Crear un Dockerfile multi-stage.

## Etapa de construcción

Debe:

1. Utilizar una versión estable de Node.
2. Instalar dependencias de forma reproducible.
3. Descargar Git LFS cuando sea necesario.
4. Ejecutar lint.
5. Ejecutar typecheck.
6. Ejecutar pruebas.
7. Ejecutar build.
8. Verificar que exista el PMTiles.
9. Verificar que no sea un puntero de Git LFS.
10. Verificar su checksum.

## Etapa de producción

Debe:

* Utilizar Nginx.
* Copiar únicamente los archivos necesarios.
* Copiar el build de Vite.
* Copiar mapas.
* Copiar estilos.
* Copiar fuentes.
* Copiar sprites.
* Copiar modelos.
* Copiar audio.
* Exponer el puerto 80.
* No requerir Node.js en ejecución.
* Ejecutarse con un usuario no privilegiado cuando sea viable.
* Tener un health check.

El proyecto debe poder ejecutarse con:

```bash
docker build -t el-salvador-rutas-perdidas .
docker run --rm -p 8080:80 el-salvador-rutas-perdidas
```

Luego debe poder abrirse:

```text
http://localhost:8080
```

---

# 27. Configuración de Nginx

Crear:

```text
nginx/default.conf
```

Debe:

* Servir la SPA.
* Redirigir rutas desconocidas hacia `index.html`.
* Servir correctamente `.pmtiles`.
* Soportar HTTP Range Requests.
* Enviar `Accept-Ranges: bytes`.
* Utilizar tipos MIME adecuados.
* Aplicar caché larga a archivos versionados.
* Evitar caché agresiva en `index.html`.
* Comprimir archivos de texto.
* Crear `/healthz`.
* Responder HTTP 200 en `/healthz`.
* No mostrar listados de directorios.
* Incluir encabezados de seguridad razonables.
* No bloquear Web Workers de MapLibre.
* Evitar configuraciones que rompan WebGL.

Agregar una prueba que verifique solicitudes parciales al archivo PMTiles.

Ejemplo esperado:

```bash
curl -I \
  -H "Range: bytes=0-1023" \
  http://localhost:8080/maps/el-salvador.pmtiles
```

La respuesta debe permitir lectura parcial del archivo.

---

# 28. Despliegue en Dokploy

Preparar el proyecto como una Application de Dokploy basada en Dockerfile.

No usar Docker Compose durante el MVP.

Configuración esperada:

```text
Container port: 80
Health path: /healthz
```

Documentar en:

```text
docs/deployment/dokploy.md
```

Explicar:

1. Cómo crear la Application.
2. Cómo conectar el repositorio.
3. Cómo seleccionar el Dockerfile.
4. Cómo configurar el puerto 80.
5. Cómo agregar el dominio.
6. Cómo habilitar HTTPS.
7. Cómo configurar `/healthz`.
8. Cómo agregar variables de entorno.
9. Cómo desplegar.
10. Cómo revisar logs.
11. Cómo verificar el mapa.
12. Cómo comprobar Range Requests.
13. Cómo realizar rollback.
14. Cómo actualizar el mapa.
15. Cómo recuperar un despliegue fallido.

No requerir volúmenes persistentes durante el MVP.

El progreso del jugador se guardará en el navegador.

---

# 29. GitHub Actions

Crear:

```text
.github/workflows/ci.yml
.github/workflows/docker.yml
```

## Pipeline de CI

Debe ejecutar:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

## Pipeline Docker

Debe:

1. Descargar el repositorio.
2. Descargar Git LFS.
3. Verificar el archivo PMTiles.
4. Construir la imagen.
5. Ejecutar el contenedor.
6. Consultar `/healthz`.
7. Verificar una solicitud Range.
8. Ejecutar una prueba básica del juego.
9. Publicar la imagen en GHCR.
10. Etiquetar con SHA del commit.
11. Etiquetar la rama principal como `latest`.

No guardar secretos en el repositorio.

Utilizar permisos mínimos necesarios.

Preparar el proyecto para que Dokploy pueda:

* Construir directamente desde el Dockerfile.

O, preferiblemente en producción:

* Descargar una imagen ya construida desde GHCR.

La aplicación debe poder funcionar con ambas estrategias.

---

# 30. Variables de entorno

Crear:

```text
.env.example
```

Incluir únicamente variables necesarias.

Ejemplo:

```env
VITE_GAME_TITLE=El Salvador: Rutas Perdidas
VITE_MAP_ARCHIVE_URL=/maps/el-salvador.pmtiles
VITE_MAP_STYLE_URL=/map-assets/styles/el-salvador.json
VITE_ENABLE_TERRAIN=false
VITE_ENABLE_THREE_PLAYER=false
VITE_DEFAULT_GRAPHICS_QUALITY=medium
```

No incluir secretos.

No utilizar una variable de entorno para algo que deba ser parte del código o configuración versionada.

---

# 31. Comandos del proyecto

Configurar scripts similares a:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check:external-resources": "node scripts/check-external-resources.mjs",
    "check:map": "bash scripts/maps/validate-map.sh",
    "check": "npm run lint && npm run typecheck && npm run test && npm run check:external-resources && npm run build"
  }
}
```

Ajustar los comandos según la configuración final.

---

# 32. Etapas de desarrollo

Trabajar por etapas.

Mantener el proyecto ejecutable después de cada etapa.

## Etapa 1: arquitectura y repositorio

* Analizar requisitos.
* Definir arquitectura.
* Crear ADR.
* Crear estructura.
* Configurar Vite, React y TypeScript.
* Configurar lint, formato y pruebas.
* Crear README inicial.
* Crear `.env.example`.

## Etapa 2: mapa autónomo

* Integrar MapLibre.
* Integrar PMTiles.
* Mostrar El Salvador.
* Utilizar estilo local.
* Utilizar fuentes locales.
* Utilizar sprites locales.
* Mostrar atribución.
* Verificar que no existan solicitudes externas.

## Etapa 3: jugador

* Agregar marcador.
* Crear game loop.
* Implementar teclado.
* Implementar movimiento.
* Implementar cámara.
* Mostrar coordenadas.
* Mostrar velocidad.
* Mantener límites generales.

## Etapa 4: ubicaciones

* Agregar lugares.
* Mostrar marcadores.
* Detectar proximidad.
* Implementar descubrimiento.
* Mostrar nombre de la región.

## Etapa 5: misiones

* Crear tres misiones.
* Crear panel.
* Iniciar misión.
* Abandonar misión.
* Completar misión.
* Entregar recompensas.

## Etapa 6: progreso

* Combustible.
* Energía.
* Experiencia.
* Nivel.
* Distancia.
* Guardado.
* Carga.
* Reinicio.
* Migración de guardado.

## Etapa 7: dispositivos móviles

* Controles táctiles.
* Responsive.
* Pruebas en viewport móvil.
* Ajustes de rendimiento.

## Etapa 8: diseño visual

* HUD.
* Pantalla de inicio.
* Menú de pausa.
* Animaciones.
* Indicadores.
* Niebla de guerra opcional.

## Etapa 9: modelos 3D

* Integrar Three.js.
* Sustituir marcador por un vehículo.
* Agregar un objeto interactivo.
* Mantener fallback 2D.
* Optimizar rendimiento.

## Etapa 10: Docker y Dokploy

* Dockerfile.
* Nginx.
* `/healthz`.
* Range Requests.
* GitHub Actions.
* Documentación.
* Prueba completa del contenedor.

No intentar implementar todas las etapas simultáneamente.

---

# 33. Procedimiento después de cada etapa

Después de cada etapa:

1. Ejecutar lint.
2. Ejecutar typecheck.
3. Ejecutar pruebas.
4. Ejecutar build.
5. Revisar URLs externas.
6. Revisar archivos modificados.
7. Documentar decisiones.
8. Actualizar README.
9. Mostrar cómo probar la etapa.
10. Corregir errores antes de continuar.

Ejecutar:

```bash
npm run check
```

No continuar cuando existan errores importantes.

---

# 34. Criterios de calidad

No aceptar:

* Pseudocódigo.
* Funciones vacías.
* Dependencias innecesarias.
* Componentes gigantes.
* Uso indiscriminado de `any`.
* Estados globales sin estructura.
* Recursos externos ocultos.
* Claves dentro del código.
* Archivos no documentados.
* Código que no compile.
* Pruebas eliminadas para ocultar errores.
* Advertencias ignoradas sin explicación.
* Dependencias externas en producción.
* Datos falsos presentados como reales.

Cuando un servicio futuro todavía no exista:

* Crear una interfaz.
* Crear una implementación local funcional.
* Documentar cómo reemplazarla.
* No crear una función que solo lance `Not implemented`.

---

# 35. Entregables

El repositorio final debe incluir:

1. Código fuente completo.
2. Archivo PMTiles.
3. Estilo local.
4. Fuentes locales.
5. Sprites locales.
6. Iconos locales.
7. Datos de ubicaciones.
8. Datos de misiones.
9. Scripts cartográficos.
10. Pruebas.
11. Dockerfile.
12. Configuración Nginx.
13. GitHub Actions.
14. README.
15. Documentación de arquitectura.
16. Documentación del mapa.
17. Documentación de Dokploy.
18. Fuentes y licencias.
19. Checksums.
20. ADR.
21. `.env.example`.
22. Instrucciones de actualización.
23. Limitaciones conocidas.
24. Próximas etapas.

---

# 36. Criterio de finalización del MVP

El MVP no se considera terminado hasta que:

* `npm install` funcione.
* `npm run dev` funcione.
* `npm run check` funcione.
* `npm run build` funcione.
* Docker compile correctamente.
* `/healthz` responda HTTP 200.
* El archivo PMTiles responda a Range Requests.
* El mapa se muestre.
* Los nombres se muestren.
* Las fuentes sean locales.
* Los sprites sean locales.
* El jugador pueda moverse.
* La cámara siga al jugador.
* Las misiones funcionen.
* El progreso se guarde.
* Los controles móviles funcionen.
* No existan solicitudes externas necesarias.
* La atribución esté visible.
* El contenedor sea compatible con Dokploy.
* El README explique el proceso completo.

---

# 37. Forma de trabajo inicial

Antes de comenzar a modificar archivos:

1. Inspecciona el repositorio.
2. Identifica qué existe actualmente.
3. No sobrescribas trabajo válido.
4. Define la arquitectura.
5. Crea el plan por etapas.
6. Decide qué tareas pueden delegarse a subagentes económicos.
7. Reserva el agente principal para las decisiones complejas.
8. Identifica riesgos.
9. Define los criterios de aceptación de la primera etapa.

Después comienza directamente con las etapas 1 y 2.

Prioridad inicial:

1. Proyecto ejecutable.
2. Mapa local de El Salvador.
3. PMTiles local.
4. Estilo local.
5. Fuentes y sprites locales.
6. Cero dependencias cartográficas externas.
7. Docker básico.
8. Documentación inicial.

No comiences todavía con Three.js avanzado, terreno detallado, backend o multijugador.

Al finalizar las etapas 1 y 2:

* Ejecuta todas las verificaciones.
* Levanta la aplicación.
* Levanta el contenedor.
* Comprueba `/healthz`.
* Comprueba el archivo PMTiles.
* Comprueba que el mapa carga sin servicios externos.
* Resume los cambios realizados.
* Documenta cómo ejecutar el proyecto.
* Continúa con la etapa del jugador solamente cuando la base sea estable.

Comienza ahora.

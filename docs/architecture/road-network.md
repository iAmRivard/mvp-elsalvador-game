# Red vial local

La red vial de v0.2 es un artefacto estático servido desde el mismo origen. El navegador no
consulta motores de rutas ni proveedores cartográficos externos. `loadRoadNetwork` solicita el
JSON durante la pantalla inicial, valida su esquema, construye el índice en memoria y reutiliza la
misma promesa para solicitudes concurrentes. Un fallo permite reintentar sin bloquear el menú.

## Contrato

`public/data/roads/western-corridor.json` usa la versión 2. Sus nodos contienen ID y coordenadas;
las aristas agregan extremos, geometría, distancia, clase, superficie, sentido y multiplicador de
velocidad. El generador conserva `surface` de OSM para distinguir vías no pavimentadas sin incluir
nombres ni metadatos que el juego no consume. El archivo mide 6.02 MiB sin comprimir y Nginx lo
entrega comprimido cuando el cliente lo admite.

La generación conserva únicamente el mayor componente conexo. Esto evita que una entrada de
estacionamiento aislada sea elegida como acceso a una misión y garantiza una base navegable entre
las zonas del capítulo.

## Índice espacial

`RoadSpatialIndex` divide el corredor en celdas de `0.0025` grados. Cada segmento se registra solo
en las celdas que toca. Una consulta convierte el radio en metros a una ventana de celdas, elimina
segmentos repetidos y proyecta la posición únicamente sobre esos candidatos. El game loop no
recorre las 23,054 aristas ni los 17,083 nodos completos.

## Superficies jugables

La clase vial conserva el costo topológico de A*, mientras la superficie gobierna conducción y HUD.
Las vías con superficie no pavimentada explícita usan `dirt-road`: ritmo `0.5`, combustible `1.35`
y condición `1.25`. `track` queda para trazas transitables más débiles y `offroad` sólo se asigna
cuando no existe una arista jugable cercana.

La capa de superficie renderiza las mismas geometrías del grafo. Carreteras principales son sólidas,
vías secundarias más delgadas y los 1,019 tramos `dirt-road` usan una línea discontinua diferenciada.
Los caminos del mapa base que no pertenecen al grafo quedan atenuados para no prometer una vía con
reglas distintas.

Las métricas de desarrollo exponen cantidad de segmentos y celdas, número de búsquedas, candidatos
de la última consulta y duración promedio. La red grande no se almacena en Zustand ni se persiste
en `localStorage`. Los resultados medidos del build de producción están en `performance.md`.

## Rastreo y game loop

`RoadTracker` consulta la cuadrícula durante la actualización de telemetría, no durante cada frame.
Cada candidato recibe puntuaciones de distancia, heading, continuidad, ruta activa, arista anterior
y clase de vía. Se penalizan tramos detrás del vehículo, giros incompatibles y calles paralelas que
no pertenecen a la ruta. La histéresis exige una mejora clara antes de cambiar de arista.

La ruta activa tiene prioridad en intersecciones, pero el giro manual reduce la asistencia para
permitir abandonar voluntariamente el camino. El paso de movimiento vuelve a proyectar solo contra
geometrías candidatas cortas para calcular superficie y corrección. Si el archivo aún carga o falla,
el perfil base continúa funcionando sin penalizaciones y el HUD comunica el estado.

Los polígonos de agua viven como datos TypeScript pequeños y se consultan sobre la posición
candidata. No dependen de que una capa del mapa esté renderizada ni de una conexión externa.

La topología también alimenta A*. La construcción crea arcos inversos solo para vías
bidireccionales; cierres y penalizaciones se aplican por ID sin modificar el JSON. El diseño del
algoritmo y su ciclo de recálculo están en `routing.md`.

## Depuración

`VITE_ROAD_DEBUG=true npm run dev` superpone en turquesa las aristas generadas. La capa es opcional,
se carga de forma diferida y se elimina junto con el mapa. Esta variable no debe habilitarse en el
build normal de Dokploy.

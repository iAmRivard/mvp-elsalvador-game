# Red vial local

La red vial de v0.2 es un artefacto estático servido desde el mismo origen. El navegador no
consulta motores de rutas ni proveedores cartográficos externos. `loadRoadNetwork` solicita el
JSON solo cuando una función jugable lo necesita, valida su esquema, construye el índice en memoria
y reutiliza la misma promesa para solicitudes concurrentes.

## Contrato

`public/data/roads/western-corridor.json` usa la versión 1. Sus nodos contienen ID y coordenadas;
las aristas agregan extremos, geometría, distancia, clase, sentido y multiplicador de velocidad.
No incluye nombres, etiquetas OSM ni metadatos que el juego no consume. El archivo mide 5.53 MiB
sin comprimir y Nginx lo entrega comprimido cuando el cliente lo admite.

La generación conserva únicamente el mayor componente conexo. Esto evita que una entrada de
estacionamiento aislada sea elegida como acceso a una misión y garantiza una base navegable entre
las zonas del capítulo.

## Índice espacial

`RoadSpatialIndex` divide el corredor en celdas de `0.0025` grados. Cada segmento se registra solo
en las celdas que toca. Una consulta convierte el radio en metros a una ventana de celdas, elimina
segmentos repetidos y proyecta la posición únicamente sobre esos candidatos. El game loop no
recorre las 23,019 aristas.

Las métricas de desarrollo exponen cantidad de segmentos y celdas, número de búsquedas, candidatos
de la última consulta y duración promedio. La red grande no se almacena en Zustand ni se persiste
en `localStorage`. Los resultados medidos del build de producción están en `performance.md`.

## Rastreo y game loop

`RoadTracker` consulta la cuadrícula durante la actualización de telemetría, no durante cada frame.
Conserva la arista activa con una histéresis de 7 m. El paso de movimiento solo vuelve a proyectar
contra esa geometría corta para calcular superficie y asistencia. Si el archivo aún carga o falla,
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

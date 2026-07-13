# Capa Three.js

La etapa 9 agrega objetos 3D sin sustituir el motor cartográfico. MapLibre continúa dibujando mapa,
edificios, rutas y etiquetas; `three-game-objects` es una capa personalizada 3D que comparte el
canvas, el contexto WebGL, la matriz de cámara y el depth buffer.

## Carga progresiva

`GameMap` se carga de forma diferida al entrar a la expedición. Si
`VITE_ENABLE_THREE_PLAYER=true` y la calidad efectiva es media o alta, realiza un segundo
`import()` para Three.js. El marcador 2D permanece visible hasta que el GLB del vehículo termina de
cargar y sólo entonces se oculta.

Ante un error de módulo, contexto o modelo, la aplicación conserva el marcador 2D sin interrumpir
el game loop. Calidad baja desactiva la capa completa para evitar el costo de descarga y render.

## Coordenadas y actualización

- `MercatorCoordinate.fromLngLat` convierte la posición del runtime al espacio compartido.
- El rumbo rota el vehículo alrededor del eje vertical; su frente está modelado hacia `-Y`.
- La escala se recalcula con el zoom para mantener un tamaño de pantalla legible.
- El game loop actualiza el objeto de forma imperativa; no provoca un render de React por frame.
- La capa sólo solicita frames adicionales cuando el jugador cambia o la baliza necesita animarse.

La capa libera geometrías, materiales, texturas y recursos del renderer al cambiar de perfil o
desmontar el mapa. No fuerza la pérdida del contexto porque éste pertenece a MapLibre.

## Baliza interactiva

La baliza aparece únicamente mientras `senales-en-suchitoto` tiene pendiente
`investigar-senal`. Su animación aumenta cerca del radio de interacción y respeta movimiento
reducido. La validación sigue perteneciendo a las reglas de misión existentes: el objeto no crea un
segundo estado ni una ruta alternativa para completar el objetivo.

## Recursos

`expedition-vehicle.glb` y `suchitoto-signal.glb` son modelos originales, sin texturas ni URI
externas. `npm run generate:models` los reconstruye desde primitivas; las pruebas validan cabecera
GLB v2, longitud declarada y un límite individual de 100 KiB.

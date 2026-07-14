# Autonomía cartográfica

El navegador solo necesita acceder al origen que sirve el juego. El estilo MapLibre apunta al
protocolo `pmtiles:///maps/el-salvador.pmtiles`; glyphs, sprites y tipografía se sirven desde
`/map-assets`. El grafo vial usa `/data/roads`, los modelos `/models` y el audio `/audio`; todas son
rutas absolutas del mismo origen.

`npm run check:external-resources` inspecciona HTML, TypeScript, CSS, JSON, SVG y GLTF de runtime.
Falla ante URLs HTTP(S) o rutas protocol-relative. La única excepción es el namespace XML de
SVG, que no inicia una solicitud de red.

Para una auditoría manual:

1. Abre las herramientas de desarrollo del navegador.
2. Filtra la pestaña Network por dominio.
3. Recarga sin caché, inicia una misión, conduce y activa el audio con una interacción.
4. Confirma que todas las solicitudes usan el dominio del juego.
5. Confirma que la atribución de OpenStreetMap permanece visible.

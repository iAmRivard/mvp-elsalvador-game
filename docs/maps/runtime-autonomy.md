# Autonomía cartográfica

El navegador solo necesita acceder al origen que sirve el juego. El estilo MapLibre apunta al
protocolo `pmtiles:///maps/el-salvador.pmtiles`; glyphs, sprites y tipografía se sirven desde
`/map-assets`.

`npm run check:external-resources` inspecciona HTML, TypeScript, CSS, JSON, SVG y GLTF de runtime.
Falla ante URLs HTTP(S) o rutas protocol-relative. La única excepción es el namespace XML de
SVG, que no inicia una solicitud de red.

Para una auditoría manual:

1. Abre las herramientas de desarrollo del navegador.
2. Filtra la pestaña Network por dominio.
3. Recarga sin caché y mueve el mapa por varios niveles de zoom.
4. Confirma que todas las solicitudes usan el dominio del juego.
5. Confirma que la atribución de OpenStreetMap permanece visible.

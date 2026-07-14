# Arranque y recursos del mapa

El estilo base vive en `public/map-assets/styles/el-salvador.json`, usa glyphs locales y referencia
el archivo principal mediante `pmtiles:///maps/el-salvador.pmtiles`. Ninguna capa usa `icon-image`,
`fill-pattern`, `line-pattern` ni `background-pattern`; por ello el estilo no declara `sprite` y
MapLibre no solicita variantes `@2x` o `@3x`.

## Ciclo de inicio

`GameMap` registra el protocolo PMTiles por montaje y avanza por **Preparando mapa**, **Preparando
carreteras**, **Preparando rutas** y **Listo para conducir**. El game loop permanece pausado hasta
terminar la preparación vial. Si la red vial falla, continúa en superficie neutral sin consumo,
velocidad, desgaste ni háptico offroad adicional.

Un error del estilo, PMTiles o creación de MapLibre muestra un mensaje amigable. **Reintentar** limpia
input, desmonta mapa/listeners/capas, libera el registro PMTiles y crea una instancia nueva sobre el
mismo store Zustand. Los detalles técnicos permanecen dentro de un `details` cerrado. Sprites,
modelos 3D y audio opcional usan fallback y no convierten por sí solos el arranque en fatal.

## Caché y servidor

Nginx sirve `/map-assets/styles/` y `/map-assets/sprites/` con `no-cache, must-revalidate` y
`try_files ... =404`. Los 404 de otras ubicaciones tampoco reciben headers de caché larga. Assets
Vite con hash y respuestas exitosas de PMTiles conservan `immutable`; PMTiles acepta Range Requests.

`scripts/maps/validate-map.sh` comprueba cabecera/checksum PMTiles, glyphs, JSON del estilo y ausencia
simultánea de propiedad `sprite` y consumidores de sprite. El workflow Docker comprueba MIME,
revalidación, 404 real, CSP, health check y respuesta parcial 206 antes de ejecutar Playwright.

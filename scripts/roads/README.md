# Generación del corredor vial

El artefacto de ejecución es `public/data/roads/western-corridor.json`. Contiene únicamente
nodos, aristas, geometría simplificada, distancia, clase, sentido y multiplicador de velocidad.
No se descarga ni consulta un servicio de rutas desde el navegador.

## Requisitos

- Node.js 24, `curl` y una implementación de MD5 (`md5` o `md5sum`).
- `osmium-tool` 1.19 o posterior. En macOS: `brew install osmium-tool`.

## Reconstrucción

```sh
npm run download:roads
npm run build:roads
npm run check:roads
```

La descarga está fijada al extracto Geofabrik `el-salvador-260712.osm.pbf` y verifica el MD5
publicado por la fuente. El PBF queda en `.cache/roads`, excluido de Git. La generación recorta el
oeste de El Salvador, filtra ocho clases transitables, conserva un corredor de 14 km alrededor de
San Salvador, Santa Tecla, Santa Ana, Coatepeque y Cerro Verde, divide las vías en cruces y
simplifica puntos interiores a 2.5 m. El resultado y su SHA-256 son deterministas.

Para auditar una fuente local alternativa puede definirse `ROAD_SOURCE`, pero un cambio de
snapshot exige actualizar explícitamente fecha, checksum, documentación y pruebas del generador.

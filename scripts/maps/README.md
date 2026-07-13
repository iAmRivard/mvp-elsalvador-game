# Reconstrucción del mapa

El artefacto de producción es `public/maps/el-salvador.pmtiles`. La vía reproducible y rápida
extrae el bounding box del país de un build diario fijado de Protomaps. Ese basemap es un
_Produced Work_ derivado de OpenStreetMap y Natural Earth.

## Requisitos

- `curl` y `sha256sum`.
- La CLI `pmtiles` v1.30 o posterior, disponible en los releases de `protomaps/go-pmtiles`.
- Al menos 2 GB libres para archivos temporales.

## Flujo

```sh
npm run sync:map-assets
scripts/maps/download-source.sh
scripts/maps/build-map.sh
scripts/maps/validate-map.sh
```

`download-source.sh` conserva el extracto OSM de Geofabrik en `.cache/maps` para auditoría y
trabajo cartográfico posterior. No se versiona porque duplica la información del PMTiles final.

`build-map.sh` usa de forma predeterminada el build Protomaps `20260710`, el bounding box
`-90.20,13.00,-87.65,14.55` y zoom máximo 15. Se pueden sustituir de forma explícita:

```sh
PROTOMAPS_BUILD_DATE=20260710 MAP_MAX_ZOOM=14 scripts/maps/build-map.sh
```

La generación termina validando la cabecera PMTiles, el archivo real de Git LFS, los recursos
de estilo y el SHA-256. Ninguna descarga ocurre al compilar o ejecutar la aplicación.

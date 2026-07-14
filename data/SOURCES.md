# Fuentes de datos cartográficos

## Artefacto de producción

- Distribución: Protomaps Basemap v4, build diario `20260710`.
- Origen fijado para reconstrucción: `https://build.protomaps.com/20260710.pmtiles`.
- Área extraída: `-90.20,13.00,-87.65,14.55`.
- Zooms incluidos: 0–15; la interfaz limita el uso a 7–15.
- Herramienta: `pmtiles extract`, CLI v1.31.0.
- Capas utilizadas por el estilo: `earth`, `landcover`, `landuse`, `water`,
  `buildings`, `boundaries`, `roads`, `places` y `pois`.

## Datos de origen

- OpenStreetMap: carreteras, hidrografía, edificios, límites, lugares y puntos de interés.
- Natural Earth: contexto terrestre e hidrográfico de zoom bajo incluido por Protomaps.
- Geofabrik: extracto PBF de El Salvador disponible para auditoría y futuras reconstrucciones
  completas mediante `scripts/maps/download-source.sh`.

## Red vial jugable

- Distribución: Geofabrik, snapshot `el-salvador-260712.osm.pbf`.
- Publicación fijada: 12 de julio de 2026, 23:45:51 UTC.
- MD5 de origen: `f3949ed1a850cd4f672fb3ad40033544`.
- Área inicial: corredor San Salvador–Santa Tecla–Santa Ana–Coatepeque–Cerro Verde.
- Artefacto: `public/data/roads/western-corridor.json`.

El grafo vial es una base de datos derivada bajo ODbL. Su procedimiento y limitaciones están en
`docs/maps/road-data.md`; la aplicación no consulta Geofabrik ni OpenStreetMap durante la ejecución.

La aplicación no consulta estas fuentes durante la ejecución. La cartografía base está en
`public/maps/el-salvador.pmtiles` y el grafo derivado en `public/data/roads`.

## Modelos 3D

El vehículo y la baliza de `public/models` son geometría original construida con primitivas de
Three.js por `scripts/models/generate-models.mjs`. No derivan de una fuente externa, no usan texturas
y no realizan solicitudes fuera del origen de la aplicación.

## Audio

Los diez WAV de `public/audio` son señales originales sintetizadas por
`scripts/audio/generate-audio.mjs`. No incorporan grabaciones, librerías de muestras ni material
descargado; el script genera PCM mono a 22.05 kHz de forma determinista.

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

La aplicación no consulta estas fuentes durante la ejecución. Todos los datos necesarios están
en `public/maps/el-salvador.pmtiles`.

## Modelos 3D

El vehículo y la baliza de `public/models` son geometría original construida con primitivas de
Three.js por `scripts/models/generate-models.mjs`. No derivan de una fuente externa, no usan texturas
y no realizan solicitudes fuera del origen de la aplicación.

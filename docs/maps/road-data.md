# Datos de carreteras

## Procedencia

- Fuente: extracto de El Salvador publicado por Geofabrik a partir de OpenStreetMap.
- Snapshot fijado: `el-salvador-260712.osm.pbf`.
- Publicación: 12 de julio de 2026, 23:45:51 UTC.
- MD5 publicado y verificado: `f3949ed1a850cd4f672fb3ad40033544`.
- Licencia: Open Database License 1.0; atribución a OpenStreetMap contributors.

La URL de descarga vive únicamente en `scripts/roads/download-source.sh`. Nunca forma parte de una
solicitud de ejecución del juego.

## Cobertura y filtros

El proceso recorta `-89.72,13.58,-89.05,14.08` y cubre San Salvador, Santa Tecla, Santa Ana, Lago de
Coatepeque y Cerro Verde. Conserva `motorway`, `trunk`, `primary`, `secondary`, `tertiary`,
`residential`, `service` y `track`, incluidos enlaces de las primeras cinco clases. Excluye áreas,
accesos privados y vías no aptas para vehículos.

Las vías principales usan un corredor amplio. Las residenciales, de servicio y pistas se limitan a
bandas y núcleos jugables para evitar descargar barrios sin función narrativa. Los cruces se
preservan, los tramos compatibles se unen, los puntos interiores se simplifican a 2.5 m y se elimina
todo componente aislado.

## Actualización

Ejecuta `npm run download:roads`, `npm run build:roads` y `npm run check:roads`. Para cambiar la
fuente hay que fijar una nueva fecha y checksum en el script, actualizar esta página y revisar
visualmente el corredor con `VITE_ROAD_DEBUG=true`. `data/road-checksums.txt` contiene el SHA-256
del artefacto final.

Limitaciones conocidas: no representa cierres reales ni tráfico; algunos accesos privados sin
etiquetado suficiente pueden permanecer; la cobertura local deliberadamente termina fuera del
corredor del capítulo.

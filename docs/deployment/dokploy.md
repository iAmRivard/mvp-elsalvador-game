# Despliegue en Dokploy

## Nueva aplicación

1. Crea una **Application** y conecta el repositorio Git.
2. Selecciona despliegue mediante `Dockerfile`; no se requiere Docker Compose.
3. Usa la raíz del repositorio como contexto y `Dockerfile` como ruta.
4. Configura el puerto interno `80`.
5. Configura el health check HTTP con la ruta `/healthz`.
6. Agrega el dominio del juego y habilita HTTPS administrado por Dokploy.
7. No agregues volúmenes: progreso, inventario y capítulo se guardan en el navegador.
8. Las variables `VITE_*` son de compilación. Define solo las de `.env.example` que quieras
   sustituir y vuelve a construir la imagen.
9. Despliega y espera que el health check quede verde.

## Verificación

```sh
curl --fail https://DOMINIO/healthz
curl --fail --header "Range: bytes=0-1023" --output map.part --write-out "%{http_code}\n" \
  https://DOMINIO/maps/el-salvador.pmtiles
curl --fail https://DOMINIO/data/roads/western-corridor.json --output /dev/null
curl --fail https://DOMINIO/audio/engine-idle.wav --output /dev/null
```

La segunda orden debe responder `206` y descargar exactamente 1024 bytes. Las dos últimas comprueban
la red jugable y el audio del mismo origen. Abre el juego, revisa mapa, ruta, vehículo y una misión,
y confirma en Network que no haya solicitudes a terceros.

## Imagen de GHCR

El workflow `docker.yml` publica `ghcr.io/PROPIETARIO/REPOSITORIO:<sha>` y `latest` desde `main`.
Para despliegues inmutables usa la etiqueta SHA; para actualizaciones automáticas se puede usar
`latest`. Dokploy también puede construir directamente desde el Dockerfile.

## Logs, rollback y recuperación

- Revisa los logs de build para fallos de LFS, checksum, npm o Vite.
- Revisa los logs del contenedor para errores de sintaxis de Nginx.
- Para rollback, selecciona el deployment anterior o la imagen con su SHA previo.
- Si falta el mapa, ejecuta `git lfs pull`, confirma que no sea un puntero y vuelve a desplegar.
- Si el health check falla, comprueba el puerto 80 y la ruta `/healthz`.
- Si el mapa no carga pero la SPA sí, verifica Range Requests, el checksum y los encabezados del
  proxy frontal.
- Si el mapa base carga pero no hay rutas jugables, verifica el JSON vial y que Nginx permita
  comprimir `application/json`.
- Si no hay audio, confirma primero una interacción del usuario y luego revisa los WAV; el navegador
  no permite iniciar Web Audio antes de ese gesto.

## Actualización del mapa

1. Instala Git LFS y la CLI PMTiles.
2. Ejecuta `scripts/maps/build-map.sh` con un build fijado.
3. Actualiza `data/SOURCES.md` y `data/MAP_VERSION.md`.
4. Ejecuta `npm run check`.
5. Confirma el nuevo archivo LFS y despliega primero en un entorno de prueba.

## Actualización de la red vial

1. Fija la nueva fecha y MD5 del extracto en `scripts/roads/download-source.sh`.
2. Ejecuta `npm run download:roads`, `npm run build:roads` y `npm run check:roads`.
3. Actualiza `data/SOURCES.md`, `docs/maps/road-data.md` y el checksum generado.
4. Recorre el capítulo y ejecuta `npm run check` y `npm run test:e2e` antes de desplegar.

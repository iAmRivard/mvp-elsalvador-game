# Despliegue en Dokploy

## Nueva aplicación

1. Crea una **Application** y conecta el repositorio Git.
2. Selecciona despliegue mediante `Dockerfile`; no se requiere Docker Compose.
3. Usa la raíz del repositorio como contexto y `Dockerfile` como ruta.
4. Configura el puerto interno `80`.
5. Configura el health check HTTP con la ruta `/healthz`.
6. Agrega el dominio del juego y habilita HTTPS administrado por Dokploy.
7. No agregues volúmenes: el progreso futuro se guardará en el navegador.
8. Las variables `VITE_*` son de compilación. Define solo las de `.env.example` que quieras
   sustituir y vuelve a construir la imagen.
9. Despliega y espera que el health check quede verde.

## Verificación

```sh
curl --fail https://DOMINIO/healthz
curl --fail --header "Range: bytes=0-1023" --output map.part --write-out "%{http_code}\n" \
  https://DOMINIO/maps/el-salvador.pmtiles
```

La segunda orden debe responder `206` y descargar exactamente 1024 bytes. Abre el juego, revisa
que aparezcan carreteras y nombres, y confirma en Network que no haya solicitudes a terceros.

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

## Actualización del mapa

1. Instala Git LFS y la CLI PMTiles.
2. Ejecuta `scripts/maps/build-map.sh` con un build fijado.
3. Actualiza `data/SOURCES.md` y `data/MAP_VERSION.md`.
4. Ejecuta `npm run check`.
5. Confirma el nuevo archivo LFS y despliega primero en un entorno de prueba.

# Validación funcional v0.2.5.3

Fecha: 16 de julio de 2026.

- SHA base: `787066658fed9907bfc74c23f18d05cb09cfae7f`.
- Rama: `codex/v0.2.5.3-camera-overlay-stability`.
- SHA candidato validado localmente: `cf7c121` y ancestros de producción.
- Versión de paquete y cache del service worker: `0.2.5.3`.

## Resultado funcional

`npm run check` aprobó lint, tipos, 76 archivos/396 pruebas, recursos locales,
mapa PMTiles de 64.38 MiB, red vial de 17,083 nodos/23,054 aristas, 20
objetivos viales con una excepción offroad explícita y build de producción.

Playwright completo local aprobó 55 pruebas, omitió 40 variantes que no
corresponden al proyecto y tuvo cero fallos. Incluye onboarding 392×850 y PWA
con service workers habilitados.

Repeticiones enfocadas:

- radio completa/compacta, advice y cola: 5/5;
- stopped → driving → fast → stopped con offset proyectado real: 5/5;
- resize con offset: 3/3;
- fallback oculto/Three.js: 3/3;
- clasificador optional/degraded/fatal: 3/3;
- tres escenarios fatales de mapa: 9/9;
- PWA real: 3/3;
- onboarding completo secuencial: 3/3.

Una ejecución inicial de onboarding con dos instancias headless paralelas
terminó una instancia 2.2 km fuera de ruta; las otras dos pasaron. No se
aumentaron timeouts. El escenario reproducible se repitió secuencialmente,
igual que el benchmark móvil, y aprobó 3/3. Esto se conserva como límite de
contención CPU/GPU de la automatización, no como validación física.

## Hallazgos de revisión

`performance_profiler` confirmó que el offset calculado no llegaba al
`jumpTo()` normal, el marcador fallback oculto seguía actualizándose y los
efectos Three.js recibían trabajo repetido.

`onboarding_auditor` confirmó que la radio se contraía visualmente pero
`OverlayManager` la conservaba como bloqueador grande. Narrativa inicial,
despausa, cinco pasos, bitácora y temporizadores permanecían funcionales.

`regression_reviewer` no encontró P0. Detectó dos P1: una carga vial tardía
podía sobrescribir un fatal con `ready`, y el cache PWA aún necesitaba el bump
v0.2.5.3. Ambos se corrigieron y se probaron. También se corrigió el P2 donde la
misma radio reutilizaba estado compacto tras `A → null → A`.

## Docker candidato

La imagen `rutas-perdidas:v0.2.5.3-test` se construyó con Docker 29.6.1 y
ejecutó `npm run check` dentro de la etapa build. Manifest list candidato:
`sha256:78325d2a43b3ff4b9b056c73d55bbbd71a33b58ea1b3dc7e36018cf2799106f9`.

Nginx devolvió:

- `/healthz`: 200 y `ok`;
- `/`: 200, CSP, `nosniff`, `SAMEORIGIN` y `Accept-Ranges`;
- PMTiles `bytes=0-1023`: 206, `Content-Range:
bytes 0-1023/67511255` y 1024 bytes exactos;
- manifest y service worker locales con cache `v0.2.5.3`;
- PMTiles y peticiones Range excluidos de Cache Storage.

Playwright completo contra `http://127.0.0.1:8080` aprobó 55, omitió 40 y no
tuvo fallos. La imagen se reconstruye y valida sobre el SHA publicable final;
los run IDs de Actions se registran en el PR.

## Pendiente físico

No se crea tag ni release. Falta probar en el teléfono objetivo:

- onboarding completo y recorrido corto;
- sesión continua de 15 minutos;
- respuesta subjetiva, tirones, calentamiento y batería;
- barra del navegador, safe areas, audio y hápticos;
- reversa, Turbo, bitácora, radio y objetivos.

Chromium headless no sustituye esas pruebas ni confirma fluidez subjetiva.

# Validación funcional y móvil v0.2.5.1

Fecha: 15 de julio de 2026. Baseline Git:
`a9018ad409cce01e0e4ec51afec0540ebbbf36a1`.

## Alcance corregido

- La narrativa inicial de **La transmisión** precede al tutorial y su cierre realiza una sola
  transición de store a `driving-basics`.
- Ruta, objetivo e interacción requieren evidencia real y sostenida; cambiar el objetivo reinicia
  el reconocimiento visual.
- `MissionPanel` se desmonta durante `introducing`/`driving-basics` y reaparece desde
  `navigation-basics`.
- La bitácora congela vehículo y entrada, pero no el tiempo real de objetivos cronometrados.
- El E2E usa interacciones normales; no contiene `force: true`, `element.click()` sintético ni una
  API que marque pasos del onboarding.
- El service worker se prueba en un proyecto PWA real separado de los proyectos deterministas.

## Onboarding completo automatizado

El proyecto Playwright `chromium-onboarding` usa 392×850 y eventos táctiles reales vía CDP. Limpia
el guardado, inicia una expedición, comprueba narrativa/pausa, cierra con **Comenzar investigación**,
gira, elige velocidad, mantiene marcha, frena sin reversa, sigue la ruta, reconoce el objetivo,
interactúa, usa Turbo y abre/cierra la bitácora. El flujo aprobó 3/3 repeticiones locales, 5/5
repeticiones de estrés servidas por Docker y el cierre de ambas matrices completas, sin omitir
pasos.

El flujo detectó además un solapamiento real: la tarjeta del paso de interacción interceptaba el
botón visible. La tarjeta se reubica para ese paso y el test conserva un clic normal, por lo que una
regresión de hit-testing vuelve a fallar.

## Temporizadores y bitácora

Vitest comprueba que el tiempo real recibido por el loop no usa un delta fijo, que abrir la
bitácora no pausa el objetivo cronometrado y que una pausa manual sí lo hace. El E2E de historia
abre la bitácora con el vehículo en marcha en escritorio, Pixel vertical y Pixel horizontal:
longitud/latitud permanecen exactas durante 2.2 s mientras el reloj visible disminuye.

## PWA

El proyecto `chromium-pwa` conserva service workers y valida:

- registro y control reales;
- navegación network-first frente a una respuesta cacheada;
- actualización visible, `SKIP_WAITING` y `controllerchange`;
- assets con hash cache-first;
- PMTiles Range `bytes=0-1023` con HTTP 206, 1024 bytes y sin entrada en Cache Storage;
- actualización diferida durante una misión activa.

La ejecución enfocada aprobó 1/1 y una repetición de estrés aprobó 5/5. Los demás proyectos
bloquean service workers para mantener deterministas las pruebas que interceptan red. La prueba
sincroniza la navegación causada por `controllerchange`, evitando consultar un contexto JavaScript
que ya está siendo reemplazado.

## Rendimiento reproducible

La metodología y los números completos están en:

- `docs/performance/mobile-baseline-v0.2.5.1.md`;
- `docs/performance/mobile-optimized-v0.2.5.1.md`.

En 30 s posteriores a 10 s de calentamiento, FPS promedio pasó de 53.98 a 54.98, frametime medio
de 20.013 a 19.453 ms y frames >33 ms de 301 a 258 (-14.3%). No hubo frames >50/>100 ms ni long
tasks. El p95 permaneció en 33.4 ms; no se declara la meta de -25% como cumplida. Las consultas
diagnósticas de capas bajaron de 30 a 0.

## Validación local

- Baseline limpio: Node 24.18.0, npm 11.16.0, `npm ci` sin vulnerabilidades, `npm run check` con 74
  archivos/345 pruebas aprobadas y Playwright con 48 aprobadas/30 omitidas.
- Implementación final: `npm run check` aprobó lint, 74 archivos/351 pruebas, tipos, build y todos
  los verificadores de datos y recursos.
- Playwright local aprobó 50 pruebas, omitió las 30 variantes que no corresponden a cada proyecto
  y no tuvo fallos en 3.3 min. El flujo cronometrado aprobó además 3/3 repeticiones enfocadas.

## Validación Docker

- Imagen local: `el-salvador-rutas-perdidas:v0.2.5.1`; digest del manifest list
  `sha256:3a7e9ab87767c707c1da99f4666cbbacde92c1e04d4b8553425c0d6aa7baa6a9`.
- El build ejecutó `npm run check` dentro de la etapa de construcción y aprobó 74 archivos/351
  pruebas.
- Nginx devolvió 200 en `/healthz` y `/`, con CSP; la solicitud Range `bytes=0-1023` al PMTiles
  devolvió 206, `Content-Range: bytes 0-1023/67511255` y exactamente 1024 bytes.
- La matriz Playwright contra `http://127.0.0.1:8080` aprobó 50 pruebas, omitió 30 y no tuvo
  fallos en 3.3 min. Incluyó PWA real y onboarding táctil completo.

Los identificadores y enlaces de GitHub Actions para el SHA publicado se registran en la entrega;
no se crea tag ni release para esta corrección.

## Validación física pendiente

No se ejecutó en el teléfono de referencia. La automatización no demuestra temperatura, batería,
safe areas del hardware, respuesta háptica, altavoz/audífonos ni fluidez percibida.

Pendientes humanos:

- sesión continua de 15 minutos en el dispositivo objetivo;
- onboarding nuevo y partida existente;
- frenado/reversa, Turbo, radio, bitácora, combustible y objetivos;
- playtest de cinco personas.

No se atribuyen resultados físicos o humanos hasta realizar y registrar esas sesiones.

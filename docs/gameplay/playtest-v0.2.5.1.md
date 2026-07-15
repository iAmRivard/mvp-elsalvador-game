# Validación de onboarding y conducción v0.2.5.1

Fecha: 15 de julio de 2026.

## Alcance

Esta corrección integra **La transmisión** con el onboarding, hace inequívoca la reversa, convierte
la bitácora en un modo de interfaz real, reduce ruido del HUD y combustible, restaura el declutter
original y valida los objetivos contra la red vial local. No cambia la cámara ni la física principal.

## Validación automatizada

- Auditoría base: Node 24.13.0, npm 11.6.2, 64 archivos/301 pruebas unitarias aprobadas.
- El E2E base tuvo 45 aprobadas, 26 omitidas y un fallo reproducible en `map-startup.spec.ts`: el
  service worker de producción respondía antes de que `page.route` pudiera inyectar el error 503.
- `npm run check`: **aprobado** en 30.2 s. Vitest aprobó 74 archivos/345 pruebas en 8.53 s;
  también se validaron 205 recursos, PMTiles de 64.38 MiB, 17,083 nodos/23,054 aristas y los
  objetivos viales antes del build de producción.
- Playwright local final: **48 aprobadas, 30 omitidas, 0 fallidas** de 78 en 3.2 min.
- Las 30 omisiones son matrices declaradas para otro proyecto/viewport: controles y layout móvil
  no corren en desktop; recuperación/arranque/objetivo y cámara desktop no se duplican donde no
  aplican; los presupuestos de viewport se ejecutan una sola vez en el proyecto móvil.
- La prueba automatizada alcanza conducción rápida y limpia en 6.2–9.6 s después de omitir el
  onboarding. El tiempo del onboarding completo sin omitir no se considera validación física.

## Presupuesto y rendimiento

Los viewports automatizados son 392×850, 412×850, 360×640, 850×412, 768×1024 y Desktop
Chrome. En todos los casos móviles se aprobó HUD superior ≤17%, controles inferiores ≤27%, mapa
útil ≥58% y tutorial ≤15%.

La captura sostenida de 30 s en Chromium móvil headless registró:

- 41.3 FPS y cámara promedio de 1.470 ms (objetivo <3 ms).
- 149 renders de `MobileDrivingHud` (muestreo de 5 Hz, no por frame).
- 0 renders de `PlayerHud`, `MissionPanel`, contenido pesado de misión y radio mientras estaban
  ocultos/desmontados.
- 4 símbolos renderizados, 20/23 capas visibles, 0 cambios de perfil declutter y 0 long tasks.

El artefacto reproducible queda en `test-results/driving-ux-v0.2.5.1/`; se generan capturas para
392×850, 412×850, 360×640, 850×412 y 768×1024, más el JSON de métricas.

## Validación Docker

**Aprobada** con Docker 29.2.0. `docker build --tag rutas-perdidas:test .` terminó correctamente
e incluyó `npm run check`. El contenedor Nginx devolvió `/healthz` 200, documento principal 200,
cabecera CSP presente y Range 0–1023 con HTTP 206 y 1024 bytes exactos. Playwright contra
`http://127.0.0.1:8080` aprobó 48, omitió 30 y falló 0 de 78 en 3.2 min. El contenedor se detuvo al
terminar.

## Validación GitHub Actions

El fallo anterior corresponde a Docker run `29445894302`, job `image` (`87456146713`), paso
**Probar mapa y autonomía en navegador**. `npm run test:e2e` terminó con código 1 porque el caso
esperaba `.map-message--error > strong` y el elemento no apareció. La causa fue el service worker
interceptando el request antes de Playwright. La corrección bloquea service workers sólo en E2E y
endurece la estrategia del SW de producción. Los resultados CI y Docker finales quedan pendientes
hasta subir el commit validado; no se crea tag mientras alguno siga pendiente.

## Validación física

No ejecutada para v0.2.5.1. Los videos de referencia prueban la versión anterior y sirven como
diagnóstico, no como aprobación de esta corrección.

## Pendientes humanos

- Recorrer el onboarding completo en el teléfono de referencia y medir tiempo hasta conducción
  limpia; el objetivo es menos de 30 segundos.
- Conducir al menos 15 minutos, incluyendo frenado/reversa, Turbo, radio, bitácora y objetivos.
- Confirmar legibilidad, safe areas, respuesta háptica y audio con altavoz y audífonos.
- Realizar el playtest previsto con cinco personas.

No se atribuyen resultados físicos o humanos a la automatización.

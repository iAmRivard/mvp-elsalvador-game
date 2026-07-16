# Resultado móvil optimizado v0.2.5.1

Fecha: 15 de julio de 2026. Baseline: `a9018ad409cce01e0e4ec51afec0540ebbbf36a1`.

## Cambios medidos

- Las consultas e inventarios de capas, memoria detallada y exportes costosos sólo se ejecutan con
  diagnósticos de desarrollo habilitados.
- La cámara calcula una sola vez su siguiente estado y evita trabajo cuando aún no vence el
  intervalo de seguimiento.
- Las fuentes de ruta, tramo inmediato y reincorporación llaman `setData` sólo cuando cambia su
  contenido.
- Telemetría semánticamente idéntica no publica otra actualización de Zustand.
- Autosave no serializa de nuevo mientras ya existe un debounce pendiente.
- La suscripción global del mapa sólo recalcula señal/objetivo ante cambios estructurales; la
  visibilidad proyectada se publica únicamente cuando cambia.

## Comparación reproducible

Mismo protocolo de Vite Preview, Chromium headless Pixel 7, 10 s de calentamiento y 30 s de
observación.

| Métrica | Baseline | Final | Cambio |
| --- | ---: | ---: | ---: |
| FPS promedio | 53.98 | 54.98 | +1.9% |
| FPS mediana | 59.88 | 59.88 | 0% |
| Frametime promedio | 20.013 ms | 19.453 ms | -2.8% |
| Frametime p95 | 33.4 ms | 33.4 ms | 0% |
| Frametime p99 | 33.4 ms | 33.4 ms | 0% |
| Frames >33 ms | 301 | 258 | -14.3% |
| Frames >50 / >100 ms | 0 / 0 | 0 / 0 | sin regresión |
| Cámara promedio / p95 | 0.899 / 1.1 ms | 1.205 / 1.6 ms | +34% / +45% |
| RoadTracker promedio / p95 | 0.060 / 0.1 ms | 0.050 / 0.1 ms | -16.7% / 0% |
| Renders de `MobileDrivingHud` | 152 | 150 | -1.3% |
| Ticks de telemetría | 285 | 284 | -0.4% |
| `queryRenderedFeatures` de diagnóstico | 30 | 0 | -100% |
| Actualizaciones GeoJSON | n/d | 138 | sólo cambios reales |
| Long tasks | 0 | 0 | sin regresión |
| Respuesta de entrada observada | 1,188 ms | 1,093 ms | -8.0% |
| Heap final expuesto por Chromium | 54.17 MiB | 37.77 MiB | orientativo |

## Conclusión

El objetivo de -25% en frametime p95 no se alcanzó: ambas capturas permanecen cuantizadas en
33.4 ms y sería incorrecto atribuir una mejora de percentil. Sí se redujeron 14.3% los frames sobre
33 ms, se eliminaron las consultas diagnósticas en producción y no aparecieron frames >50 ms,
pausas >100 ms ni long tasks. El p95 de cámara subió a 1.6 ms, todavía pequeño frente al frame,
pero queda como punto de observación física; no se redujo calidad gráfica para maquillar la cifra.

La ruta, el vehículo y los objetivos se verifican con pruebas unitarias y E2E. Falta perfilar en un
teléfono físico durante 15 minutos; Chromium headless no demuestra temperatura, batería, GPU ni
fluidez percibida.

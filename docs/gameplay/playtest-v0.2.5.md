# Validación de conducción v0.2.5

Fecha: 15 de julio de 2026.

## Evidencia de referencia

Se revisaron los dos videos entregados antes de cambiar la implementación.

| Medida observable            |           Escritorio 1920×1080 |                Móvil 392×850 |
| ---------------------------- | -----------------------------: | ---------------------------: |
| Zoom/pitch aproximado        |                     15.8 / 52° | variable, sin perfil estable |
| Tamaño aparente del vehículo |                         ~28 px |             ~16 px a 61 km/h |
| Etiquetas visibles           |                     más de 100 |              30–40 a 61 km/h |
| HUD superior                 |                           ~20% | 22% a 34 km/h; 28% a 61 km/h |
| Panel de misión              |           incluido en overlays |                         ~18% |
| Controles inferiores         |                            n/a |                       25–26% |
| Banda central continua       | amplia, con ruido cartográfico |               ~18% a 34 km/h |

El seguimiento llamaba `easeTo` en actualizaciones normales, variaba entre zoom 15.8 y 14.8 y
desplazaba el vehículo aproximadamente 10% bajo el centro. El estilo base tenía 13 capas; el ruido
principal provenía de `poi-labels`, `place-labels`, `local-roads` y `buildings`.

## Decisiones implementadas

### Estado central

`DrivingPresentationController` es la única fuente para presentación. Usa 5/6 km/h para entrar o
salir de detenido, 58/52 km/h para `fast`, espera 1.25 s antes de declarar `stopped` y prioriza
alertas bloqueantes. Las interacciones sólo sustituyen la conducción hasta 8 km/h.

### Perfiles de cámara

| Perfil          |  Zoom | Pitch | Offset alto | Actualización | Transición |
| --------------- | ----: | ----: | ----------: | ------------: | ---------: |
| `stopped`       | 15.55 |   56° |         17% |         45 ms |      60 ms |
| `urban`         | 15.30 |   60° |         21% |         33 ms |      45 ms |
| `fast`          | 15.05 |   62° |         23% |         33 ms |      40 ms |
| `mobileStopped` | 15.65 |   55° |         19% |         50 ms |      60 ms |
| `mobileDriving` | 15.40 |   59° |         24% |         40 ms |      50 ms |
| `mobileFast`    | 15.15 |   61° |         26% |         40 ms |      45 ms |

El loop usa `jumpTo` para seguimiento normal y `easeTo` sólo al recentrar. El bearing visual se
suaviza y limita a ±12°. La cámara publica duración actual/promedio, actualizaciones por segundo,
interrupciones, perfil, zoom, pitch y offset mediante `data-*` y el panel de diagnóstico.

### Prioridad de capas

| Prioridad                  | Detenido | Conduciendo | Rápido   |
| -------------------------- | -------- | ----------- | -------- |
| Navegación, objetivo, ruta | completa | completa    | completa |
| Vías principales           | 95%      | 100%        | 100%     |
| Vías/etiquetas secundarias | 28–90%   | 18–22%      | ocultas  |
| Lugares importantes        | 100%     | 90%         | 80%      |
| POI secundarios            | 100%     | 6%          | ocultos  |
| Edificios                  | 72%      | 30%         | ocultos  |

Los cambios se agrupan durante 250–400 ms y sólo usan propiedades de layout/paint. Las capas que
faltan se registran sin detener el juego. La ruta agrega chevrones de línea locales; movimiento
reducido los desactiva.

### HUD, tutorial, radio y audio

- En movimiento, móvil muestra maniobra, próximo objetivo, distancia, velocidad, combustible,
  condición y timer. Escritorio conserva un HUD compacto expandible.
- La bitácora se cierra al comenzar a conducir y se abre al tocar el HUD. La radio en marcha usa
  como máximo tres líneas y abre el historial de transmisiones.
- El tutorial no pausa; ocho pasos avanzan por acciones detectadas y el reconocimiento de objetivo
  usa confirmación manual. Siempre queda fuera de los controles primarios.
- Motor, rodadura, viento y ruido de superficie son loops locales. Pitch y ganancia responden a
  velocidad normalizada, aceleración, Turbo, superficie y pausa.

## Presupuesto responsive automatizado

`tests/e2e/driving-presentation.spec.ts` inicia una expedición real, acelera hasta `fast` y mide las
cajas del DOM. Las cuatro variantes táctiles cumplen:

- HUD de conducción: máximo 17% de la altura;
- superficie inferior de controles: máximo 27% (referencia de diseño ~25%);
- mapa útil descontando ambas superficies: mínimo 58%;
- cero solapamientos entre HUD y controles y todas las cajas dentro del viewport;
- perfil `mobileFast`, declutter `fast`, ruta visible y HUD secundario oculto.

Viewports: 412×850, 850×412, 768×1024 y 360×640. Landscape reduce el joystick a 58% del
tamaño configurado y coloca utilidades/Turbo en una fila; los objetivos quedan entre 40 y 48 px.

## Estabilidad heredada

- `RoadTracker` contabiliza un miss como máximo cada 250 ms. Cuatro muestras forman la gracia real
  de un segundo en 30, 60, 90 y 120 Hz; un contacto válido recupera de inmediato.
- Turbo conserva el objetivo seleccionado, usa 137 km/h como objetivo efectivo durante 2.5 s y
  vuelve al objetivo previo en 1 s con frenado automático limitado a 18%.
- Manifest, icono, service worker y fullscreen progresivo no alteran guardado ni flujo de juego.

## Protocolo de cierre

Automático obligatorio antes del tag:

1. `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`.
2. Auditoría de recursos, mapa y red vial.
3. Playwright completo usando un puerto que sirva este repositorio.
4. Build Docker `el-salvador-rutas-perdidas:v0.2.5` y `/healthz` HTTP 200.

## Resultado automatizado

Ejecutado el 15 de julio de 2026:

- `npm run check`: aprobado. Incluye lint, typecheck, 64 archivos/301 pruebas unitarias, auditoría
  de 201 recursos, mapa local de 64.38 MiB, red vial de 17,083 nodos/23,054 aristas y build Vite.
- Playwright completo: 46 pruebas aprobadas, 26 omisiones intencionales por proyecto y cero fallos
  con dos workers. Cubre escritorio, Pixel 7 vertical/horizontal, tablet y 360×640.
- Captura Pixel 7 a 84 km/h: HUD superior de 68 px (8.1%), controles inferiores dentro del 27%,
  perfil `mobileFast`, declutter `fast`, 18/21 capas visibles y cero transiciones de cámara
  interrumpidas. La captura es evidencia headless, no una medición de FPS físico.
- Docker no pudo ejecutarse: el entorno denegó acceso a `C:\\Users\\admin\\.docker\\config.json` y
  al pipe `docker_engine`. No se atribuye build de imagen ni `/healthz` aprobado.

Pendiente y no sustituible por automatización:

- prueba en el teléfono exacto de los videos;
- sesión física continua de 15 minutos;
- playtest de cinco personas con legibilidad, fatiga, tutorial, Turbo y radio;
- confirmación humana de audio en altavoz y audífonos.

No se atribuyen resultados humanos hasta ejecutar y registrar esas sesiones.

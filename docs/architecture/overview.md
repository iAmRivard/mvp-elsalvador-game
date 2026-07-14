# Arquitectura del MVP

La aplicación es una SPA estática sin backend. Vite produce los archivos que Nginx sirve junto
con el archivo PMTiles y todos sus recursos auxiliares.

```text
React (interfaz y ciclo de vida)
  └─ GameMap
      ├─ MapLibre GL JS (cámara y render WebGL)
      ├─ Three.js diferido (vehículo y objeto interactivo)
      ├─ protocolo pmtiles://
      ├─ red vial local e índice espacial diferidos
      ├─ rutas e indicadores de misión
      ├─ eventos narrativos y audio Web Audio local
      └─ /maps/el-salvador.pmtiles
```

Las responsabilidades se separan así:

- `src/config`: variables validadas y valores seguros del mismo origen.
- `src/components/map`: ciclo de vida imperativo de MapLibre, fuera del render frecuente.
- `src/components/menu`: entrada a la expedición, tutorial, pausa y ajustes visuales.
- `src/components/story`: paneles de radio y cierre narrativo.
- `src/audio`: carga, mezcla y ciclo de vida del audio local.
- `src/map`: adaptadores técnicos, comenzando por el protocolo PMTiles.
- `src/roads`: carga validada, índice de cuadrícula y consultas sobre el corredor vial.
- `src/data`: ubicaciones, capítulo, misiones, objetos, restricciones y escenario declarativos.
- `src/game`: movimiento y reglas puras de proximidad, objetivos y recompensas.
- `public/map-assets`: estilo y glyphs locales; los sprites técnicos heredados no forman parte del runtime.
- `public/models`: modelos GLB propios y autocontenidos.
- `public/audio`: catorce efectos y pistas WAV locales generados dentro del proyecto.
- `scripts/maps`: adquisición, construcción, validación y checksums reproducibles.
- `scripts/models`: generación reproducible de los modelos 3D.
- `scripts/roads`: descarga fijada, construcción y validación del grafo local.
- `scripts/audio`: generación determinista del audio PCM.

El jugador utiliza un game loop basado en `requestAnimationFrame`. Posición, cámara y marcador se
actualizan de forma imperativa; Zustand recibe telemetría limitada a 10 Hz, nunca una actualización
de React por frame. El cálculo geodésico es independiente de FPS, limita delta time y conserva el
runtime mutable fuera del árbol de componentes. La velocidad vehicular y la distancia geográfica
están separadas por una escala de viaje central; combustible utiliza la primera y el odómetro la
segunda.

La cámara deriva zoom, pitch y offset de la velocidad sin guardar estado por frame en React. Usa
transiciones breves durante el seguimiento y una transición aislada al recentrar. Los detalles se
documentan en `follow-camera.md` y el perfil arcade en `../gameplay/vehicle-handling.md`.

El corredor vial se sirve como JSON compacto desde el mismo origen. Se carga una vez bajo demanda,
permanece fuera de Zustand y se indexa en celdas de `0.0025` grados. Las búsquedas inspeccionan
segmentos vecinos y registran mediciones simples de duración; consulta `road-network.md`.

Zustand conserva el estado de ubicación y misión a una frecuencia adecuada para la interfaz. La
posición sigue perteneciendo al game loop; las rutas de misión son capas GeoJSON locales que
enlazan al jugador con el objetivo pendiente más cercano.

La partida se hidrata sincrónicamente desde `localStorage` antes de iniciar MapLibre. Guardar no
modifica el game loop y el autosave agrupa cambios para evitar escrituras a 10 Hz. Cargar o reiniciar
incrementa una revisión de runtime; `GameMap` usa esa señal para reemplazar el jugador mutable y
reposicionar marcador y cámara. El contrato persistente se documenta en `save-format.md`.

La interfaz inicial evita cargar el chunk cartográfico hasta que el usuario entra a la expedición.
Las preferencias visuales y de audio usan un documento local versionado independiente del guardado
para que reiniciar el juego no borre accesibilidad, calidad, mezcla o tutorial. El flujo y sus
decisiones se detallan en `interface.md`.

La interfaz inicial queda separada del motor cartográfico. MapLibre se carga al entrar a la
expedición y Three.js usa otro `import()` que sólo se solicita en calidad media o alta. En el build
de la v0.2, el chunk inicial mide 283.58 KiB, el motor cartográfico 1,028.13 KiB y la capa Three.js
608.77 KiB, todos sin comprimir. Los modelos GLB se solicitan después de crear la capa y no bloquean
el fallback 2D. Las mediciones de runtime y tamaños gzip están en `performance.md`.

## Criterios de aceptación técnicos

1. `npm run check` termina sin errores.
2. El estilo usa exclusivamente rutas locales y `pmtiles://`.
3. El PMTiles existe, tiene cabecera válida y checksum documentado.
4. Mapa, nombres, carreteras, agua y atribución se muestran sin terceros en runtime.
5. La SPA es responsive, accesible y explica la falta de WebGL.
6. La imagen Docker sirve `/healthz` y responde 206 a una petición Range del mapa.
7. Rutas, red vial, modelos y audio se solicitan exclusivamente al mismo origen.
8. Las partidas v1/v2 migran al formato v3 sin perder progreso ni combustible.

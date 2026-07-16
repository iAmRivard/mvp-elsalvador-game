# Changelog

## v0.2.5.2 - 2026-07-16

### Fluidez y cámara móvil

- La cámara táctil de calidad media/alta pasa a una cadencia objetivo de 33 ms, filtra cambios
  insignificantes y conserva perfiles cercanos para conducción y velocidad alta.
- La histéresis sigue evaluándose aunque el vehículo quede quieto, por lo que una transición desde
  `mobileFast` termina correctamente en `mobileStopped`.
- Un fallo tardío de recurso de MapLibre ya no desmonta un mapa que terminó de iniciar; se degrada y
  registra, mientras pérdida de contexto WebGL y fallos de arranque conservan recuperación bloqueante.
- Las métricas separan FPS por throughput de FPS instantáneo, registran el SHA y modo de build, y
  nombran `evento → próximo RAF` sin presentarlo como latencia visual real.

### Tutorial y presentación

- El onboarding obligatorio se reduce a cinco pasos: girar, seleccionar velocidad, mantener marcha,
  frenar y seguir la línea cian. Objetivo, interacción, Turbo y bitácora pasan a consejos compactos.
- La superficie decorativa de los consejos deja pasar clics a controles y bitácora; únicamente sus
  botones explícitos capturan interacción.
- Las acciones táctiles de misión se consumen como pulsos one-shot, permitiendo dos interacciones
  consecutivas sin perder la segunda durante la ventana de liberación.
- La radio móvil se contrae después de una vista previa y puede reabrirse sin perder el evento.
- Estaciones de combustible con nivel suficiente quedan como iconos discretos; la ayuda completa se
  reserva para combustible bajo o para un objetivo seleccionado.
- Vehículo, ruta inmediata y cámara móvil ganan presencia visual sin cambiar física ni contenido.

### Compatibilidad y validación

- Guardados heredados en pasos posteriores del tutorial migran a conducción libre sin repetir
  instrucciones.
- Service worker y pruebas PWA usan caches `v0.2.5.2`; PMTiles y solicitudes Range siguen fuera del
  cache.
- Playwright cubre onboarding táctil, consejos contextuales, jerarquía de overlays y restauración de
  cámara al detenerse.

## v0.2.5.1 - 2026-07-15

### Onboarding y controles

- La introducción de **La transmisión** aparece antes del tutorial; cerrar `Comenzar investigación`
  realiza una transición atómica a `driving-basics`, conserva la misión y despausa el juego.
- Seguir la ruta exige avance sostenido sobre red vial válida, sin offroad, reversa ni
  reincorporación. Reconocer el objetivo usa proximidad de 300 m o visibilidad proyectada durante
  1.5 s y reinicia el tiempo al cambiar de objetivo.

- Las partidas nuevas activan **La transmisión** como misión tutorial y avanzan por nueve
  instrucciones contextuales sin CTA de siguiente misión ni confirmaciones manuales.
- El guardado sube al esquema 5 con estado de onboarding explícito; las partidas v1–v4 migran sin
  perder progreso y se consideran ya introducidas para no repetir el tutorial.
- La velocidad objetivo reconoce 600 ms de marcha centrada aunque el control automático aplique
  throttle. Frenado exige desaceleración real y Turbo sólo se enseña en un contexto seguro.
- La reversa requiere frenar, soltar/centrar y volver a bajar durante 550 ms. Pausa, blur, cambio de
  control, bitácora, recuperación y nueva partida limpian el estado de reversa.

### HUD, bitácora y mapa

- `MissionPanel` desaparece por completo en móvil durante introducción y conducción básica, y el
  mini-navegador vuelve desde `navigation-basics`. Las acciones contextuales no quedan detrás de la
  bitácora ni de la tarjeta móvil del tutorial.
- La simulación del vehículo se congela con la bitácora abierta, pero los objetivos cronometrados
  reciben el delta real del loop y continúan avanzando.
- Diagnósticos de capas quedan fuera de producción, cámara y store evitan trabajo redundante y las
  fuentes GeoJSON sólo se actualizan cuando cambia su contenido.

- La bitácora es estado global: en móvil desmonta controles y HUD, congela el vehículo, conserva
  la velocidad objetivo y deja avanzar el temporizador de la misión.
- El HUD detenido permanece compacto durante tres segundos y sólo se expande manualmente. El HUD
  pesado se desmonta durante conducción móvil y el contenido pesado de misión no se monta cerrado.
- La ayuda de combustible desaparece en nivel normal, queda discreta entre 25–35% y pasa a CTA
  crítico por debajo de 25%. La radio completa permanece hasta que el jugador la cierre.
- La presentación se deriva de todos los estados bloqueantes y el declutter captura y restaura
  exactamente los valores originales, incluidos expresiones y propiedades dinámicas.
- Un validador comprueba todos los objetivos contra el grafo local. Los puntos narrativos separados
  usan `interactionCoordinates` y las zonas viales válidas evitan falsos avisos offroad.

### CI, PWA y verificación

- Playwright añade proyectos aislados para el onboarding táctil completo 392×850 y para el service
  worker real: update/`SKIP_WAITING`, navegación network-first, assets cache-first y PMTiles Range
  206 sin cachear. Las interacciones de juego usan clics reales, sin `force` ni `element.click()`.

- Playwright bloquea service workers durante E2E para que las intercepciones de red sean
  deterministas. Producción conserva el SW con navegación network-first, assets versionados
  cache-first, exclusión de PMTiles/Range y activación de actualización explícita.
- El inicio ofrece fullscreen desde el gesto del usuario y continúa normalmente cuando la API no
  está disponible.
- `npm run check` incorpora la validación de alcance vial de objetivos. Los resultados locales,
  Docker, Actions y pendientes físicos se registran en `docs/gameplay/playtest-v0.2.5.1.md`.

## v0.2.5 - 2026-07-15

### Conducción y percepción de velocidad

- Un controlador central con histéresis deriva `stopped`, `driving`, `fast`, `alert` e `interaction`
  desde velocidad, alertas, overlays y pausa; cámara, HUD y mapa consumen el mismo estado.
- Seis perfiles de seguimiento para escritorio y tacto ajustan zoom, pitch y offset. El seguimiento
  usa actualizaciones imperativas y reserva `easeTo` para recentrar, sin acumular transiciones.
- Declutter dinámico clasifica capas por prioridad, reduce opacidad al conducir y oculta calles,
  POI y edificios secundarios en `fast`; la ruta, el objetivo y las vías principales permanecen.
- La ruta suma chevrones lineales locales, con tramo inmediato más fuerte y respeto a movimiento
  reducido. Motor, rodadura, viento y superficie responden a velocidad, aceleración y Turbo.

### HUD, tutorial y experiencia móvil

- El HUD móvil de conducción muestra sólo maniobra, objetivo, distancia, velocidad, combustible,
  condición y timer; tocarlo abre la bitácora y la reversa pausa la guía visual.
- El HUD de escritorio se compacta al moverse y permite expansión manual. La radio en marcha usa
  tres líneas, no bloquea y abre transmisiones desde un toque.
- Tutorial contextual de nueve pasos detecta acciones automáticas sin botón Siguiente ni pausa.
  Landscape coloca acciones en fila y portrait/tablet/360×640 respetan safe areas y presupuestos.

### Plataforma, estabilidad y pruebas

- Manifest, icono, service worker, pista de instalación y fullscreen progresivo habilitan una
  experiencia PWA sin romper navegadores que no exponen esas APIs.
- El contacto vial móvil muestrea misses cada 250 ms, conserva la gracia de un segundo y recupera
  de inmediato. Turbo conserva el objetivo seleccionado y usa objetivo efectivo de 137 km/h.
- 301 pruebas unitarias cubren presentación, cámara, declutter, HUD, audio, contacto vial y Turbo.
  Playwright mide cajas y perfiles en escritorio, Pixel portrait/landscape, tablet y 360×640.
- La prueba física en el teléfono de referencia y el playtest de cinco personas siguen pendientes;
  no se sustituyen con automatización.

## v0.2.4.1 - 2026-07-14

### Conducción y red vial móvil

- Las instalaciones nuevas usan `target-speed-joystick`: arriba ajusta un objetivo persistente de
  0–90 km/h, centrar conserva la marcha, el eje horizontal gira sin alterar el objetivo y abajo
  frena antes de habilitar reversa tras 350 ms detenido. Turbo conserva el objetivo previo.
- Los cuatro controles anteriores siguen disponibles. Preferencias v1–v7 migran al esquema 8 sin
  reemplazar una elección existente y reciben una única recomendación del modo nuevo.
- `RoadTracker` usa radio móvil de 52 m, recuperación sobre el último edge hasta 70 m, gracia de
  1 segundo y cuatro misses consecutivos antes de declarar offroad.
- La recuperación temporal usa `road-unclassified` con ritmo 70%, consumo 115% y desgaste 105%.
  Diagnósticos exponen edge actual/anterior, distancia, misses, gracia, motivo y 20 transiciones.

### Navegación e interfaz

- La reversa se detecta con velocidad firmada y oculta chevrón, tramo inmediato, reincorporación y
  mensajes de avance.
- El vehículo usa triángulo cian y el chevrón amarillo se coloca 35 m por delante sobre la ruta, con
  offset de MapLibre como fallback y sin transformar el elemento raíz.
- La misión activa se contrae al conducir y deja un mini navegador con maniobra, distancia,
  objetivo y acceso **Ver objetivo**. La bitácora móvil es un bottom sheet al 55%/85%.
- Una cola determinista muestra un solo overlay grande con prioridad crítica, narrativa, radio,
  descubrimiento e información. La radio móvil ocupa como máximo 25% y los descubrimientos se
  compactan cuando coincide una transmisión.

### Combustible, guardado y pruebas

- Con más de 35% no aparece ayuda extra; entre 25–35% se muestra una estación discreta con distancia
  y por debajo de 25% aparece el CTA crítico. Una ruta temporal muestra **Volver a misión**.
- El guardado sube a versión 4 y persiste sólo `kind` e `id` del destino temporal. Al cargar valida
  disponibilidad, recalcula A* y vuelve a la misión con aviso si el destino desapareció.
- Pruebas unitarias e integración cubren velocidad objetivo, histéresis, punto urbano del video,
  flecha, reversa, mini navegador, bottom sheet, overlays, combustible y migraciones. Playwright
  cubre escritorio, Pixel 7 vertical y horizontal.
- La prueba física en el teléfono del video continúa pendiente y no se sustituye por automatización.

## v0.2.4 - 2026-07-14

### Navegación y mapa

- La orientación física del vehículo permanece separada del heading recomendado; una flecha cian
  independiente, el texto y el tramo inmediato derivan del mismo segmento activo.
- La proyección de ruta prioriza continuidad local, aplica histéresis y distingue el conector
  discontinuo de reincorporación de la ruta vial principal.
- La red vial sube al esquema 2 con `dirt-road`, 17,083 nodos, 23,054 aristas y estilos jugables
  coherentes para vías pavimentadas, caminos de tierra, senderos y terreno offroad.
- Los marcadores limitan etiquetas según zoom, prioridad, colisión, pitch y viewport; sus detalles
  muestran estado, distancia y una acción para marcar ruta.

### Móvil, tutorial y combustible

- Tutorial móvil compacto de nueve pasos para vehículo, ruta, objetivo, conducción, frenado, Turbo,
  interacción, combustible y reincorporación, sin cubrir controles ni CTA de misión.
- CTA persistente para iniciar, continuar o navegar a la siguiente misión desde la bitácora móvil
  contraída.
- Nuevo modo predeterminado `single-drive-joystick`: ambos ejes controlan aceleración, frenado,
  reversa y giro; los tres modos anteriores siguen disponibles y las preferencias migran a v7.
- Tres puntos narrativos de combustible con icono y color exclusivos, leyenda, distancia, destino
  temporal A*, recarga gratuita de 45%, retorno automático a la misión y bidón de emergencia.
- Alertas a 25% y 10% ofrecen estación, autonomía y bidón; 0% conserva checkpoint, lugar seguro y
  recuperación de emergencia para evitar bloqueos.

### Pruebas

- 249 pruebas unitarias y de integración cubren heading, reincorporación, superficies, marcadores,
  tutorial, joystick, migración, estaciones, recarga y softlocks.
- Playwright termina con 30 pruebas aprobadas y 15 omisiones intencionales en escritorio, Pixel 7
  vertical y horizontal, incluidos ruta vial a combustible, recarga, retorno a misión y separación
  geométrica de ayuda, joystick y acciones.
- El playtest físico de cinco personas continúa pendiente y no se sustituye por resultados
  automatizados.

## v0.2.3 - 2026-07-14

### Historia y misiones

- Premisa inicial reescrita, siguiente misión recomendada, tarjeta **Continuar historia** y CTA
  compacto cuando la bitácora móvil está contraída.
- Radio normal no bloqueante, modales obligatorios marcados como juego en pausa y bitácora con
  historia, misiones, transmisiones y descubrimientos.
- Interacción principal con `E`, fallback con Espacio, acciones contextuales y objetivos pasivos o
  de recolección lenta automatizados.
- Elección norte/sur persistente en **Camino bloqueado**, cierres A* distintos, consumo, desgaste,
  consecuencia visible, cuenta regresiva y temporizador de 4:30 con reintento preelección.

### Balance, audio y móvil

- Combustible inicial de partidas nuevas en 75%, consumo por distancia geográfica, autonomía,
  estimación al destino, advertencia y recuperación de emergencia limitada.
- Tres pistas musicales WAV originales para exploración, misión y tiempo, crossfade de 1.5 s,
  ducking de radio, atenuación en pausa y volumen independiente.
- Migración opcional a Joystick + crucero, sección Controles enlazada directamente, contadores
  derivados, cooldown de Turbo preservado y reset completo sólo en recuperación o partida nueva.
- Reiniciar dentro del juego vuelve a alinear el vehículo aunque la red vial ya esté montada.

### Pruebas y documentación

- Simulaciones A* para ambos desvíos, Turbo, offroad, combustible bajo y protección contra softlock.
- Playwright cubre historia, radio, elección, timer, persistencia, combustible, reinicio y geometría
  en escritorio, móvil vertical y horizontal sin solicitudes externas.
- El playtest físico de cinco personas permanece explícitamente pendiente; no se atribuyen
  resultados humanos a la validación automatizada.

## v0.2.2 - 2026-07-14

### Agregado

- Modo móvil recomendado **Joystick + crucero**, con `AUTO` apagado al entrar y ayuda de primer uso.
- Turbo móvil por toque durante 2.5 segundos, cooldown de 1.8 segundos, cuenta regresiva y estados
  disponible, activo, enfriando, sin combustible y averiado.
- Reintento de MapLibre sin recargar la página ni perder progreso, con error técnico colapsado.
- Advertencias únicas de condición a 25 %, 10 % y 0 %, háptico opcional y recuperación de emergencia.
- Tooltips visibles y accesibles para acciones de escritorio, menú `⋯` y cabecera móvil compacta.

### Corregido

- Eliminada la dependencia de sprite vacío que provocaba `basemap@2x.json` 404 en DPR alto.
- Nginx ya no aplica caché larga a 404 y revalida estilos/sprites sin versión.
- Condición ausente o inválida migra a 100; una condición numérica 0 se conserva y activa recuperación.
- La preparación o indisponibilidad vial usa superficie neutral, sin desgaste ni penalización offroad.
- La partida nueva se alinea una vez con la vía cercana y actualiza su checkpoint inicial.
- Desgaste offroad rebalanceado para no averiar el vehículo durante los primeros minutos.

### Interfaz y pruebas

- Ruta cian `#28D7F5`, casing `#06242C`, tramo inmediato `#D8FBFF`, fallback `#FF9F43` y objetivo
  `#FFE169`.
- Cobertura unitaria para temporizadores, cancelaciones, migración, recuperación, desgaste, posición
  inicial, colores y tooltips.
- Playwright cubre móvil vertical/horizontal, reintento fatal, condición 0, guardado antiguo, canvas,
  autonomía y DPR 2/3 sin solicitudes de sprite.
- La prueba física en teléfono continúa explícitamente pendiente y debe completarse antes del visto
  bueno humano de la versión.

## v0.2.1 - 2026-07-14

### Agregado

- Entrada analógica continua con clamp, zona muerta, curva de respuesta y fuentes separadas para
  teclado, puntero, pedales, joystick y crucero.
- Joystick fijo o flotante, acelerador, freno/reversa, turbo, interacción contextual y cruceta
  clásica como tres modos móviles configurables.
- Crucero `AUTO` con estado activo/suspendido, reducción offroad y cancelación por freno, pausa,
  diálogo, recuperación, fallo o combustible agotado.
- Preferencias móviles v5 con migración, tres tamaños, zona muerta, hápticos y sensibilidad común.
- Subpasos geográficos de 10 m con límite de 12 para restricciones, bloqueos, objetivos y desgaste.
- Puntuación vial por distancia, heading, continuidad, ruta activa, arista previa y clase, con
  histéresis para intersecciones y calles paralelas.
- Precarga compartida de red vial, métricas por etapa y panel de diagnóstico solo en desarrollo.
- Web Worker vial con IDs, cancelación lógica, timeout, respuestas antiguas, fallback y caché LRU.
- Instrucciones de giro, segmento inmediato, flecha, distancia, fuera de ruta y estado de cálculo.
- Tutorial progresivo de nueve pasos adaptado a joystick, crucero, cruceta o teclado.

### Corregido

- Limpieza central de input ante pérdida de foco, pestaña oculta, cambio de orientación, pausa,
  diálogo, cambio de control, desmontaje, recuperación y fallo.
- Procesamiento de objetivos dentro de subpasos para no atravesarlos durante un frame lento.
- Priorización de aristas de la ruta activa sin oscilación frecuente en cruces.
- Solicitudes duplicadas de ruta que podían cancelar la vigente y activar un fallback incorrecto.
- Sprites `@2x`, posición inicial del marcador y arranque de alta densidad de píxeles.
- Scroll interno causado por foco de diálogos y cruces entre HUD, bitácora, tutorial, atribución y
  controles en móvil vertical u horizontal.

### Rendimiento y pruebas

- Preparación vial medida entre 123.1 y 137.4 ms y A* largo entre 14.5 y 19.4 ms en Chromium
  headless local; el JSON de 5.53 MiB se solicita una vez.
- 37 archivos de pruebas unitarias y de integración, además de Playwright con `15 passed` y
  `3 skipped` intencionales en escritorio, Pixel 7 vertical y horizontal.
- Validación por píxeles del canvas antes y después de conducir, autonomía de runtime y layout
  geométrico de controles.
- Guía y plantilla de cinco sesiones físicas agregadas; las sesiones con personas y dispositivos
  reales continúan explícitamente pendientes.

## Unreleased - v0.2 Fases 1-7

### Agregado

- Escala de viaje geografico configurable y separada de la velocidad del HUD.
- Perfil central de manejo con aceleracion, frenado, reversa, giro y turbo.
- Sensibilidad de direccion local (`Suave`, `Equilibrada`, `Directa`) con migracion de preferencias.
- Camara de seguimiento con zoom y pitch dinamicos, encuadre adelantado y recentrado suave.
- Pruebas de escala, combustible, turbo, frenado, reversa, pausa, delta time, limites y camara.
- Corredor vial occidental local con 17,048 nodos y 23,019 aristas derivadas de OpenStreetMap.
- Pipeline reproducible de descarga, filtrado, simplificacion, checksum y validacion vial.
- Carga diferida, validacion de esquema, indice espacial por cuadricula y metricas de busqueda.
- Proyeccion sobre geometria y deteccion de la carretera mas cercana sin barrido global.
- Capa de depuracion opcional mediante `VITE_ROAD_DEBUG=true`.
- Asistencia vial libre, suave o firme con correccion gradual e histeresis en cruces.
- Limites de velocidad y consumo por ocho clases de via y terreno offroad.
- Poligonos locales de agua, frenado seguro y respuesta visual ante zonas restringidas.
- Estado de terreno y penalizaciones en el HUD, con fuerza tactil adaptada.
- Migracion de preferencias version 3 para conservar ajustes existentes.
- Servicio A* local con extremos proyectados, sentidos unicos, cierres y penalizaciones.
- Geometria de mision sobre carreteras, cache de 32 rutas y metricas de desarrollo.
- Recalculo por objetivo, desvio, cierre, boton o teclado con enfriamiento.
- Fallback directo explicito para objetivos sin cobertura, sin bloquear misiones.
- Inventario local validado con cantidades maximas, consumo y migracion de objetos existentes.
- Condicion del vehiculo, desgaste por terreno e impactos, reparacion y carga de combustible.
- Objetivos funcionales de recoleccion, reparacion, combustible y tiempo con progreso persistente.
- Checkpoints de mision, ciudad, estacion y objetivo con reintento y regreso seguro.
- Guardado version 2 con migracion explicita desde partidas version 1 y estados heredados.
- Dialogos de inventario y recuperacion, mas condicion visible en el HUD.
- Capitulo 1 **La senal de Occidente** con seis misiones conectadas y una mision opcional.
- Eventos de radio al iniciar misiones, descubrir el cierre vial y completar el capitulo.
- Dependencias entre objetivos para habilitar acciones, rutas y temporizadores en el orden correcto.
- Cierre narrativo de una arista y recalculo A* comprobado sobre un desvio mas largo.
- Estacion de Las Delicias y estacion abandonada de El Congo como puntos jugables y checkpoints.
- Diez efectos WAV locales con generador determinista, mezcla Web Audio y desbloqueo por interaccion.
- Volumen general, volumen de efectos, silencio y reduccion de efectos en preferencias version 4.
- Cincuenta y cinco referencias 3D instanciadas, balizas genericas, luces de freno y polvo offroad.
- Metricas de carga vial, busqueda, ruta, FPS y memoria expuestas solo como diagnostico del runtime.
- Flujo E2E de combustible, inventario, reparacion y finalizacion en tres viewports.
- Pruebas de integracion para rutas del capitulo, zonas de agua, recursos de audio y escenario.

### Cambiado

- La camara se actualiza cada 33 ms en escritorio, 50 ms en dispositivos tactiles y 66 ms en calidad baja.
- El zoom jugable utiliza el intervalo 14.8-15.8 y permite overzoom vectorial hasta nivel 16.
- Arrastrar, hacer zoom, rotar o inclinar manualmente desactiva el seguimiento hasta solicitar recentrado.
- Las pruebas E2E usan selectores persistentes para configuracion, descubrimientos y misiones.
- La antigua mision `camino-hacia-santa-ana` conserva su ID y migra el progreso previo a la nueva
  secuencia del capitulo.
- La mision de Coatepeque conserva su ID y ahora cierra el capitulo con tres puntos de exploracion.
- La pulsacion tactil de interaccion mantiene un pulso de 250 ms para no perder toques entre
  actualizaciones de telemetria.

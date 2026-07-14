# Changelog

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

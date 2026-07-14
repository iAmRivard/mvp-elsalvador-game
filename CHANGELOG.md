# Changelog

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

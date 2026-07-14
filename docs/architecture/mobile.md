# Adaptación móvil y rendimiento

La interfaz mantiene el mapa a pantalla completa y reorganiza sus capas según ancho, alto,
orientación, puntero y zonas seguras del dispositivo.

## Controles

- La cruceta ocupa la esquina inferior izquierda.
- Turbo e interacción forman la fila principal derecha.
- Centrar cámara y pausar permanecen disponibles en una segunda fila.
- Todos los botones bloquean selección, menú contextual y scroll durante una pulsación.
- Una pérdida de foco o pestaña oculta limpia acciones retenidas para evitar movimiento involuntario.
- La acción de objetivo conserva un pulso de 250 ms al soltarla para que un toque rápido no caiga
  entre dos entregas de telemetría; conducción y turbo mantienen semántica de pulsación sostenida.

La bitácora comienza contraída en pantallas de hasta 600 píxeles o dispositivos táctiles de poca
altura. Al cambiar de orientación vuelve a contraerse. En vertical, el HUD se convierte en una barra
compacta; en horizontal, HUD y bitácora ocupan laterales opuestos por encima de los controles.

## Perfil gráfico

`src/game/deviceProfile.ts` combina la calidad elegida en la interfaz —inicializada con
`VITE_DEFAULT_GRAPHICS_QUALITY`— con memoria, número de procesadores, densidad de píxeles, puntero
y movimiento reducido.

- `medium` baja automáticamente a `low` en hardware con hasta 4 GB o 4 procesadores lógicos.
- `low` desactiva antialias y animaciones decorativas, limita el pixel ratio y actualiza rutas con
  menor frecuencia.
- `high` respeta la elección explícita hasta un pixel ratio de 2.
- La preferencia **Reducir movimiento** se combina con la preferencia del sistema y desactiva las
  transiciones no esenciales.
- En pantallas táctiles se usan gestos directos de MapLibre sin el requisito cooperativo.
- En layout compacto se omiten controles redundantes de navegación y escala; pinch, giro e
  inclinación continúan disponibles sobre el mapa.
- La cámara se actualiza cada 50 ms en dispositivos táctiles y cada 66 ms en calidad baja. El
  encuadre se adapta a orientación vertical u horizontal y mantiene el vehículo debajo del centro.
- Teclado y cruceta comparten el mismo perfil de manejo y la sensibilidad elegida.
- La asistencia vial usa el mismo modo elegido y multiplica su fuerza por 1.18 en dispositivos
  táctiles; velocidad, combustible y colisiones permanecen idénticos.

## Pruebas

Playwright define proyectos para Chrome de escritorio, Pixel 7 vertical y Pixel 7 horizontal. Las
pruebas móviles verifican el flujo de inicio y tutorial, presencia de todos los botones, ausencia de
scroll, límites del viewport, separación entre HUD/bitácora y entre cruceta/acciones, además de
movimiento por puntero. El flujo del capítulo también recoge combustible, consume inventario,
repara el vehículo y completa misiones en vertical y horizontal.

# Adaptación móvil y controles

La interfaz mantiene el mapa a pantalla completa y reorganiza sus capas según ancho, alto,
orientación, tipo de puntero y zonas seguras del dispositivo. La entrada móvil comparte el mismo
`PlayerInput` continuo que teclado y game loop; no escribe en Zustand durante cada movimiento.

## Entrada analógica

`InputController` conserva por separado teclado, botones de puntero, pedales táctiles, joystick y
crucero. `snapshot()` suma y limita las fuentes manuales a `[-1, 1]`; una entrada manual sustituye
temporalmente al crucero y el freno lo desactiva. Teclado mantiene valores digitales, mientras el
joystick entrega giro parcial después de aplicar clamp, zona muerta y curva de respuesta.

`clearAllInput()` limpia teclas, punteros, timers, pedales, joystick, turbo, interacción y crucero.
Se ejecuta al perder foco o visibilidad, pausar, abrir un diálogo, cambiar modo u orientación,
recuperar la partida, fallar una misión y desmontar el mapa. Liberar o cancelar un puntero también
restaura su control sin dejar valores retenidos.

## Modos

- **Joystick y pedales**, predeterminado: dirección izquierda; turbo, acelerador y freno/reversa a
  la derecha; interacción contextual solo cuando existe una acción.
- **Joystick y crucero**: el botón `AUTO` mantiene throttle `0.72`; el jugador conserva dirección,
  freno, turbo e interacción. Fuera de carretera baja a 55 % y no se reactiva solo.
- **Botones clásicos**: conserva la cruceta digital completa como alternativa accesible.

El joystick fijo tiene radio de 72 px, knob de 30 px, zona muerta inicial `0.14` y curva `1.45`.
También existe posición flotante dentro de una zona válida del lado izquierdo. Pointer Events,
`setPointerCapture` y un ID activo único permiten touch, stylus y mouse; el centro no cambia durante
el gesto y el valor vuelve a cero al liberar, cancelar o perder captura.

## Preferencias y hápticos

La sección **Controles móviles** permite modo, posición fija o flotante, tamaño pequeño/mediano/grande,
zona muerta, crucero inicial y vibración. La sensibilidad de dirección existente se aplica también
al joystick. `settingsStore` usa versión 5 y migra documentos 1 a 4 conservando calidad, audio,
asistencia y accesibilidad.

Los eventos hápticos son pulsos cortos para botón, turbo, offroad, colisión, objetivo y crucero. Se
pueden desactivar y `navigator.vibrate` es opcional; nunca se mantiene una vibración por frame.

## MapLibre y layout

Cada superficie de control usa `touch-action: none`, evita selección y menú contextual y detiene el
evento antes de llegar al mapa. Fuera de esas superficies permanecen pan, pinch zoom, rotación,
inclinación y recentrado. La atribución de MapLibre inicia compacta y su botón queda en el hueco
inferior central, fuera de joystick y pedales.

La bitácora comienza contraída en pantallas de hasta 600 px o dispositivos táctiles de poca altura.
Al cambiar orientación vuelve a contraerse. En vertical, HUD y misión se apilan por encima de los
controles; en horizontal, el HUD compacto queda a la izquierda, la misión reserva el centro y los
pedales ocupan la derecha. Todos los bordes usan `env(safe-area-inset-*)`.

## Perfil gráfico

`src/game/deviceProfile.ts` combina la calidad elegida, memoria, procesadores, densidad de píxeles,
puntero y movimiento reducido.

- `medium` baja automáticamente a `low` en hardware con hasta 4 GB o 4 procesadores lógicos.
- `low` desactiva antialias y animaciones decorativas, limita pixel ratio y reduce actualizaciones.
- `high` respeta la elección explícita hasta un pixel ratio de 2.
- Movimiento reducido combina preferencia local y `prefers-reduced-motion`.
- En layout compacto se omiten navegación y escala redundantes de MapLibre.
- La cámara se actualiza cada 50 ms en táctil y cada 66 ms en calidad baja.
- La asistencia vial multiplica su fuerza por 1.18 en táctil sin cambiar colisiones ni consumo.

## Pruebas

Playwright usa Chrome de escritorio, Pixel 7 vertical y Pixel 7 horizontal. Comprueba joystick
analógico, dos punteros simultáneos, pedales, turbo, crucero, cancelaciones, persistencia, cruceta,
interacción, MapLibre fuera del control, ausencia de scroll y separación geométrica de HUD, misión,
joystick, acciones y atribución. La prueba de autonomía también inspecciona píxeles del canvas antes
y después de conducir.

La matriz automatizada final fue `15 passed` y `3 skipped`; las omisiones son casos táctiles no
aplicables a escritorio. La validación física y sus límites están en
`docs/gameplay/mobile-controls-playtest.md`.

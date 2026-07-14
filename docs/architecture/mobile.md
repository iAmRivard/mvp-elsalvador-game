# Adaptación móvil y controles

La interfaz mantiene el mapa a pantalla completa y reorganiza sus capas según ancho, alto,
orientación, tipo de puntero y zonas seguras del dispositivo. La entrada móvil comparte el mismo
`PlayerInput` continuo que teclado y game loop; no escribe en Zustand durante cada movimiento.

## Entrada analógica

`InputController` conserva por separado teclado, botones de puntero, pedales táctiles, joystick de
dirección, joystick de conducción y crucero. `setDriveJoystick()` actualiza throttle y turn de forma
atómica; `snapshot()` limita cada eje a `[-1, 1]`. Teclado mantiene valores digitales, mientras los
joysticks aplican clamp, zona muerta y curva de respuesta.

`clearAllInput()` limpia teclas, punteros, timers, pedales, joystick, turbo, interacción y crucero.
Se ejecuta al perder foco o visibilidad, pausar, abrir un diálogo, cambiar modo u orientación,
recuperar la partida, fallar una misión y desmontar el mapa. Liberar o cancelar un puntero también
restaura su control sin dejar valores retenidos.

Turbo de teclado continúa siendo sostenido con `Shift`. Turbo móvil usa un estado independiente:
2.5 segundos activo y 1.8 segundos de enfriamiento. Un ticker de 50 ms actualiza sólo suscriptores de
interfaz; el game loop sigue leyendo un booleano desde `snapshot()`. Freno y toda interrupción central
cancelan el temporizador.

## Modos

- **Joystick único**, predeterminado para instalaciones nuevas: X gira y Y controla aceleración,
  frenado y reversa. Al bajar mientras avanza primero frena hasta cero; sólo entonces aplica reversa
  limitada a `0.55`. Mantiene Turbo, interacción, pausa y recentrado, sin pedales ni `AUTO` obligatorio.
- **Joystick + crucero**: el botón `AUTO` mantiene throttle `0.72`; comienza apagado y nunca se
  reactiva solo. Joystick queda a la izquierda; Turbo, freno e interacción quedan a la derecha.
- **Joystick + pedales**: conserva acelerador y freno sostenidos como control manual.
- **Botones clásicos**: conserva la cruceta digital completa como alternativa accesible.

Documentos de preferencias existentes mantienen su modo. Un documento antiguo sin `controlMode`
recibe `joystick-pedals`; sólo la ausencia total de preferencias usa el nuevo recomendado.

El joystick de conducción usa zonas muertas `0.12` horizontal y `0.16` vertical, exponentes `1.4`
y `1.25`, umbral de freno `-0.18` y reversa máxima `0.55`. El joystick fijo tiene radio de 72 px,
knob de 30 px, zona muerta inicial `0.14` y curva `1.45`.
También existe posición flotante dentro de una zona válida del lado izquierdo. Pointer Events,
`setPointerCapture` y un ID activo único permiten touch, stylus y mouse; el centro no cambia durante
el gesto y el valor vuelve a cero al liberar, cancelar o perder captura.

## Preferencias y hápticos

La sección **Controles móviles** permite modo, posición fija o flotante, tamaño pequeño/mediano/grande,
zona muerta y vibración. La sensibilidad de dirección se aplica también al joystick. `settingsStore`
usa versión 7: instalaciones nuevas eligen joystick único; documentos v1-v6 conservan su modo y
reciben una recomendación descartable una sola vez.

Los eventos hápticos son pulsos cortos para botón, turbo, offroad, colisión, condición, objetivo y crucero. Se
pueden desactivar y `navigator.vibrate` es opcional; nunca se mantiene una vibración por frame.

## MapLibre y layout

Cada superficie de control usa `touch-action: none`, evita selección y menú contextual y detiene el
evento antes de llegar al mapa. Fuera de esas superficies permanecen pan, pinch zoom, rotación,
inclinación y recentrado. La atribución de MapLibre inicia compacta y su botón queda en el hueco
inferior central, fuera de joystick y pedales.

La bitácora comienza contraída en pantallas de hasta 600 px o dispositivos táctiles de poca altura.
Su CTA permite iniciar, continuar o ir al comienzo sin scroll. El tutorial usa una tarjeta movible
de hasta 25% de la altura y pasa a un lateral en horizontal. La ayuda de combustible se coloca sobre
los controles en vertical y en el espacio central en horizontal; pruebas geométricas impiden cruces
con joystick y acciones. Todos los bordes usan `env(safe-area-inset-*)`.

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

Playwright usa Chrome de escritorio, Pixel 7 vertical y Pixel 7 horizontal. Comprueba joystick único
en diagonal, frenado, reversa, pérdida de foco, Turbo simultáneo, modos alternativos, persistencia,
interacción, ausencia de scroll y separación geométrica de HUD, misión, combustible, joystick,
acciones y atribución. La prueba de autonomía también inspecciona píxeles del canvas antes y después
de conducir.

También abre contextos DPR 2 y 3 y confirma que el mapa no solicita sprites. La validación física y
sus límites están en
`docs/gameplay/mobile-controls-playtest.md`.

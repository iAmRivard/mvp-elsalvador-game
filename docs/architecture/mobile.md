# Adaptación móvil y controles

La interfaz mantiene el mapa a pantalla completa y reorganiza sus capas según ancho, alto,
orientación, tipo de puntero y zonas seguras del dispositivo. La entrada móvil comparte el mismo
`PlayerInput` continuo que teclado y game loop; no escribe en Zustand durante cada movimiento.

## Entrada analógica

`InputController` conserva por separado teclado, botones de puntero, pedales táctiles, joystick de
dirección, joystick de conducción, crucero y velocidad objetivo. `setTargetSpeedJoystick()` recibe
`verticalIntent` y giro sin convertir el gesto inmediatamente en throttle. El game loop llama
`advanceMobileCruise()` y una respuesta proporcional compara objetivo y velocidad firmada.
`snapshot()` limita cada eje a `[-1, 1]`; el gesto no escribe en Zustand ni en `localStorage`.

`clearAllInput()` limpia teclas, punteros, timers, pedales, joystick, turbo, interacción, crucero y
objetivo móvil. La decisión de seguridad es cancelar el objetivo, no conservarlo, al pausar o perder
foco. Centrar o soltar sólo el puntero usa `clearPointerActions()` y sí conserva el objetivo.
Se ejecuta al perder foco o visibilidad, pausar, abrir un diálogo, cambiar modo u orientación,
recuperar la partida, fallar una misión y desmontar el mapa. Liberar o cancelar un puntero también
restaura su control sin dejar valores retenidos.

Turbo de teclado continúa siendo sostenido con `Shift`. Turbo móvil usa un estado independiente:
2.5 segundos activo y 1.8 segundos de enfriamiento. Un ticker de 50 ms actualiza sólo suscriptores de
interfaz; el game loop sigue leyendo un booleano desde `snapshot()`. Freno y toda interrupción central
cancelan el temporizador.

## Modos

- **Velocidad objetivo**, predeterminado para instalaciones nuevas: arriba ajusta progresivamente
  0–90 km/h, centrar mantiene el objetivo y X gira sin modificarlo. Abajo reduce, frena a cero y,
  después de 350 ms casi detenido, activa reversa. El indicador muestra detenido, lento, crucero,
  rápido, frenando o reversa. Turbo no modifica el objetivo.
- **Joystick único**: conserva el throttle continuo de v0.2.4 como alternativa. X gira y Y controla
  aceleración, frenado y reversa.
- **Joystick + crucero**: el botón `AUTO` mantiene throttle `0.72`; comienza apagado y nunca se
  reactiva solo. Joystick queda a la izquierda; Turbo, freno e interacción quedan a la derecha.
- **Joystick + pedales**: conserva acelerador y freno sostenidos como control manual.
- **Botones clásicos**: conserva la cruceta digital completa como alternativa accesible.

Documentos de preferencias existentes mantienen su modo. Un documento antiguo sin `controlMode`
recibe su fallback histórico; sólo la ausencia total de preferencias usa el nuevo recomendado. El
aviso **Velocidad objetivo** se muestra una sola vez a instalaciones anteriores y permite probar o
mantener sus controles.

El joystick de conducción usa zonas muertas `0.12` horizontal y `0.16` vertical, exponentes `1.4`
y `1.25` y dominancia vertical `1.12`; una intención horizontal aislada produce `verticalIntent=0`.
El modo heredado conserva umbral de freno `-0.18` y reversa máxima `0.55`. El joystick fijo tiene radio de 72 px,
knob de 30 px, zona muerta inicial `0.14` y curva `1.45`.
También existe posición flotante dentro de una zona válida del lado izquierdo. Pointer Events,
`setPointerCapture` y un ID activo único permiten touch, stylus y mouse; el centro no cambia durante
el gesto y el valor vuelve a cero al liberar, cancelar o perder captura.

## Preferencias y hápticos

La sección **Controles móviles** permite modo, posición fija o flotante, tamaño pequeño/mediano/grande,
zona muerta y vibración. La sensibilidad de dirección se aplica también al joystick. `settingsStore`
usa versión 8: instalaciones nuevas eligen velocidad objetivo; documentos v1-v7 conservan su modo y
reciben una recomendación descartable una sola vez.

Los eventos hápticos son pulsos cortos para botón, turbo, offroad, colisión, condición, objetivo y crucero. Se
pueden desactivar y `navigator.vibrate` es opcional; nunca se mantiene una vibración por frame.

## MapLibre y layout

Cada superficie de control usa `touch-action: none`, evita selección y menú contextual y detiene el
evento antes de llegar al mapa. Fuera de esas superficies permanecen pan, pinch zoom, rotación,
inclinación y recentrado. La atribución de MapLibre inicia compacta y su botón queda en el hueco
inferior central, fuera de joystick y pedales.

La bitácora comienza contraída en pantallas de hasta 600 px o dispositivos táctiles de poca altura.
Al iniciar misión abre un resumen `half`; después de 2.5 segundos y al superar 5 km/h queda un mini
navegador con maniobra, distancia y objetivo. **Ver objetivo** abre un bottom sheet al 55% (`half`),
expandible al 85%, con handle, scroll interno y cierre sticky. No se renderiza el cuerpo completo al
estar contraído.

Una cola determinista permite sólo un overlay grande: recuperación/elección, narrativa, radio,
descubrimiento e información. Radio usa hasta 25% de altura debajo del mini navegador; si coincide
un descubrimiento, éste se vuelve toast compacto. La ayuda de combustible sólo aparece entre
25–35%, bajo 25% o mientras hay ruta temporal. Todos los bordes usan `env(safe-area-inset-*)`.

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

Playwright usa Chrome de escritorio, Pixel 7 vertical y Pixel 7 horizontal. Comprueba incremento y
retención de objetivo, giro aislado, frenado, reversa, limpieza por pausa, Turbo, modos alternativos,
mini navegador, bottom sheet, radio, combustible contextual, persistencia de ruta y separación
geométrica de HUD, chevrón, joystick, acciones y atribución. La prueba de autonomía también
inspecciona píxeles del canvas antes y después de conducir.

También abre contextos DPR 2 y 3 y confirma que el mapa no solicita sprites. La validación física y
sus límites están en
`docs/gameplay/mobile-controls-playtest.md`.

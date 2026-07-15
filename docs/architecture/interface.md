# Interfaz visual y menús

La etapa 8 mantiene el mapa como superficie principal durante la expedición y agrega una capa de
navegación completa antes y durante la partida.

## Flujo

1. La aplicación abre en una pantalla inicial y todavía no descarga ni inicializa MapLibre.
2. **Continuar expedición** hidrata el guardado disponible; **Comenzar expedición** usa el estado
   inicial. Una partida nueva sobre un guardado siempre requiere confirmación.
3. La primera entrada pausa el runtime y presenta un tutorial progresivo de nueve pasos adaptado al
   control activo.
4. `Escape`, el control táctil o `Ⅱ` abren el menú de pausa. Volver al inicio realiza un guardado
   silencioso antes de desmontar el mapa.

La pantalla inicial no es un guardado separado: refleja el estado que `gameStore` hidrató al cargar
la página. El mapa está envuelto en `React.lazy` para mantener el motor WebGL fuera del primer chunk.

## Preferencias locales

`settingsStore` persiste un documento versionado bajo
`el-salvador-rutas-perdidas:settings`. Contiene:

- calidad gráfica `low`, `medium` o `high`;
- reducción de movimiento;
- atmósfera decorativa;
- tutorial completado;
- sensibilidad de dirección `low`, `medium` o `high`;
- asistencia de carretera `off`, `soft` o `strong`;
- volumen general y volumen de efectos entre 0 y 1;
- silencio y reducción de efectos intensos;
- modo móvil, posición y tamaño de joystick, zona muerta, crucero inicial y hápticos.

Estas preferencias no forman parte del guardado de la expedición. Reiniciar progreso no debe borrar
decisiones de accesibilidad. Cambiar calidad o movimiento recrea MapLibre para aplicar antialias,
pixel ratio y tiempos de cámara de manera coherente; cambiar la atmósfera sólo actualiza una capa
CSS sin interacción. La sensibilidad se lee desde el game loop y cambia sin reconstruir el mapa.
La versión 8 agrega velocidad objetivo como opción predeterminada de instalaciones nuevas y un aviso
único que no reemplaza el modo existente. La versión 7 agregó joystick único con throttle continuo.
La versión 6 agregó volumen y silencio de música, además del primer aviso para migrar controles.
La versión 5 agregó controles móviles y migró documentos 1 a 4 con joystick fijo mediano, zona
muerta `0.14`, pedales, crucero inicial desactivado y hápticos activos. La versión 4 agregó audio;
documentos anteriores cargan volúmenes 0.7 y 0.8. La versión 3 agregó asistencia vial; versiones 1 y
2 cargan `soft`. La sensibilidad ausente continúa migrando a `medium`.

## Indicadores

- El combustible no crea ayuda adicional por encima de 35%; entre 25–35% muestra un chip discreto
  con estación y distancia, y por debajo de 25% un CTA crítico. La ruta temporal muestra distancia
  y **Volver a misión**.
- El bloque de terreno muestra clase de vía, porcentaje de ritmo y consumo, estado offroad y una
  advertencia textual cuando agua, un bloqueo o los límites detienen el vehículo.
- La ruta activa anuncia que el objetivo está cercano al entrar a 1,5 veces su radio de validación.
- Una subida de nivel genera una notificación descartable con tiempo limitado.
- Inicio de misión, objetivo, combustible bajo, descubrimiento e interferencia tienen señales
  sonoras locales equivalentes a sus indicadores visuales.
- El movimiento decorativo respeta tanto la configuración local como
  `prefers-reduced-motion: reduce`.

Los diálogos declaran nombre accesible y modalidad. Las acciones mantienen texto visible o
`aria-label`; ninguna señal necesaria depende únicamente de color o animación.

## Conducción y overlays móviles

Una misión activa se resume en un mini navegador. Tras 2.5 segundos y al superar 5 km/h, el resumen
se contrae sin volver a expandirse automáticamente. La bitácora usa estados `compact`, `half` y
`expanded`, límites de 55dvh/85dvh, handle, scroll interno y controles sticky.

`OverlayManager` ordena candidatos con prioridad `critical`, `narrative`, `radio`, `discovery` e
`information`. Sólo monta un overlay grande. Recuperación y elección obligatoria preceden a
narrativa; narrativa precede a radio. Una radio activa degrada descubrimientos a toast compacto.
Radio y descubrimientos no pausan el juego; los diálogos que sí pausan lo indican.

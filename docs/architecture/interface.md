# Interfaz visual y menús

La etapa 8 mantiene el mapa como superficie principal durante la expedición y agrega una capa de
navegación completa antes y durante la partida.

## Flujo

1. La aplicación abre en una pantalla inicial y todavía no descarga ni inicializa MapLibre.
2. **Continuar expedición** hidrata el guardado disponible; **Comenzar expedición** usa el estado
   inicial. Una partida nueva sobre un guardado siempre requiere confirmación.
3. La primera entrada pausa el runtime y presenta un tutorial de tres pasos.
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
- tutorial completado.

Estas preferencias no forman parte del guardado de la expedición. Reiniciar progreso no debe borrar
decisiones de accesibilidad. Cambiar calidad o movimiento recrea MapLibre para aplicar antialias,
pixel ratio y tiempos de cámara de manera coherente; cambiar la atmósfera sólo actualiza una capa
CSS sin interacción.

## Indicadores

- El combustible cambia a advertencia bajo 20 % y a estado crítico bajo 10 %.
- La ruta activa anuncia que el objetivo está cercano al entrar a 1,5 veces su radio de validación.
- Una subida de nivel genera una notificación descartable con tiempo limitado.
- El movimiento decorativo respeta tanto la configuración local como
  `prefers-reduced-motion: reduce`.

Los diálogos declaran nombre accesible y modalidad. Las acciones mantienen texto visible o
`aria-label`; ninguna señal necesaria depende únicamente de color o animación.

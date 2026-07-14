# Rendimiento y diagnósticos

La pantalla inicial precarga `GameMap`, la red vial y el worker antes de entrar a la expedición. El
JSON usa una promesa compartida, se descarga una sola vez y se conserva en memoria. El índice del
hilo principal alimenta detección y asistencia; una copia transferible prepara A* dentro del worker.
El game loop mantiene objetos imperativos por frame y entrega telemetría a React a 10 Hz.

## Diagnóstico de desarrollo

Con `VITE_ENABLE_DIAGNOSTICS=true npm run dev`, el panel muestra:

- FPS, tiempo aproximado de frame, throttle, turn, puntero y crucero;
- superficie, edge elegido, distancia, score y primeros candidatos viales;
- búsqueda espacial, tiempo total de ruta, tiempo del worker y nodos expandidos;
- aciertos/entradas de caché, carga, índice, memoria vial y heap cuando está disponible.

Los mismos valores relevantes se exponen como atributos `data-*` para Playwright. El panel requiere
`import.meta.env.DEV`, por lo que no aparece en el build de producción aunque la variable se defina.
Ninguna métrica entra en Zustand, guardado o lógica de balance.

## Medición v0.2.1

Medición del build de producción del 14 de julio de 2026 con Chromium Playwright headless y calidad
baja. La ruta representativa va de San Salvador al Repetidor de Las Delicias, tiene 179 coordenadas
y expande 4,570 nodos. Cada perfil usa un contexto nuevo y servidor local sin latencia de Internet.

| Medida                           | 1280x800 | Pixel 412x839 |
| -------------------------------- | -------: | ------------: |
| Pantalla inicial lista           | 435.1 ms |      335.2 ms |
| Juego listo después de comenzar  |  1.785 s |       1.253 s |
| Preparación vial total           | 137.4 ms |      123.1 ms |
| Descarga                         |  95.9 ms |       89.6 ms |
| `JSON.parse`                     |  17.2 ms |       16.2 ms |
| Validación                       |   6.6 ms |        3.7 ms |
| Índice espacial                  |  16.1 ms |       12.4 ms |
| Búsqueda vial                    | 0.038 ms |      0.058 ms |
| Solicitud completa de ruta       |  21.5 ms |       15.3 ms |
| A* dentro del worker             |  19.4 ms |       14.5 ms |
| Memoria vial aproximada          |  9.5 MiB |       9.5 MiB |
| Solicitudes del JSON vial        |        1 |             1 |
| FPS observado durante la muestra |     27.0 |          53.9 |

La máquina cumplió las referencias de menos de 5 s para conducir, menos de 1.5 s para preparar la
red y menos de 150 ms para A*. Chromium headless renderiza WebGL por software y comparte CPU entre
workers de prueba; el FPS de escritorio de esta tabla no representa una GPU real. FPS estable,
fatiga y frames largos mayores de 150 ms todavía requieren el playtest físico documentado.

## Worker y recuperación

Cada operación usa un `requestId`. Una ruta nueva cancela lógicamente la anterior; respuestas sin
solicitud pendiente se cuentan como antiguas y no se aplican. El timeout es 4 s. Un error o navegador
sin Worker usa A* local como fallback, mientras una respuesta obsoleta se descarta para no reemplazar
la ruta vigente. El router y su caché LRU de 32 entradas permanecen dentro del worker.

## Tamaños del build

- Grafo vial: 5,795,394 bytes; 17,048 nodos y 23,019 aristas.
- Memoria vial aproximada: 9.5 MiB por índice y estructuras del hilo principal.
- Worker vial: 22.86 KiB sin comprimir.
- CSS: 132.59 KiB, 23.09 KiB gzip.
- Chunk inicial: 309.49 KiB, 92.59 KiB gzip.
- `GameMap`: 64.17 KiB, 22.12 KiB gzip.
- Capa Three.js: 608.77 KiB, 154.48 KiB gzip.
- Motor cartográfico diferido: 1,028.13 KiB, 273.19 KiB gzip.

Los nombres hash y tamaños pueden variar con el bundler. `npm run build`, `npm run test:e2e` y los
atributos de diagnóstico son la fuente para una medición nueva; CI no fija umbrales de FPS de
hardware que Chromium headless no puede representar.

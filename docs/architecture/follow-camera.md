# Camara de seguimiento

La camara de Fase 1 se calcula fuera de React a partir del runtime mutable del jugador. El game loop
actualiza marcador, capa Three.js y camara de forma imperativa; Zustand continua recibiendo
telemetria a 10 Hz.

## Perfil dinamico

`src/config/followCamera.config.ts` define tres puntos de referencia:

| Estado                     | Zoom |     Pitch |
| -------------------------- | ---: | --------: |
| Detenido                   | 15.8 | 52 grados |
| Crucero                    | 15.3 | 56 grados |
| Velocidad maxima con turbo | 14.8 | 60 grados |

`followCameraTarget` interpola con `smoothstep` usando la magnitud de la velocidad representada. La
transicion evita saltos al acelerar o frenar y trata la reversa con la misma distancia de camara.
Calidad baja limita el pitch a 50 grados; pantallas compactas lo limitan a 56 grados.

## Frecuencia y encuadre

- Escritorio: actualizacion cada 33 ms y transicion de 40 ms.
- Dispositivo tactil: actualizacion cada 50 ms y transicion de 60 ms.
- Calidad baja: actualizacion cada 66 ms y transicion de 50 ms.
- Movimiento reducido: actualizacion directa sin animacion.

El objetivo se desplaza verticalmente entre 28 y 112 pixeles segun el viewport. El vehiculo queda
debajo del centro y deja mas mapa visible por delante. Un cambio de tamano recalcula el offset sin
recrear MapLibre.

## Control manual

Una interaccion original de arrastre, zoom, rotacion o inclinacion desactiva el seguimiento. El
boton de centrar lo reactiva con una transicion de 260 ms; durante esa transicion no se encadenan
animaciones cortas. Cargar o reiniciar la partida reposiciona la camara de inmediato sobre el
runtime restaurado.

Los atributos `data-follow-zoom`, `data-follow-pitch` y `data-follow-offset-y` se actualizan de forma
imperativa para las pruebas E2E y no provocan renders de React.

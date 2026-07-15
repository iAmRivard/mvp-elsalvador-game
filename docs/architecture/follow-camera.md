# Camara de seguimiento

La camara de Fase 1 se calcula fuera de React a partir del runtime mutable del jugador. El game loop
actualiza marcador, capa Three.js y camara de forma imperativa; Zustand continua recibiendo
telemetria a 10 Hz.

## Perfil dinamico

`src/config/followCamera.config.ts` define seis perfiles seleccionados por el estado central:

| Perfil        |  Zoom | Pitch | Offset alto |
| ------------- | ----: | ----: | ----------: |
| stopped       | 15.55 |    56 |         17% |
| urban         | 15.30 |    60 |         21% |
| fast          | 15.05 |    62 |         23% |
| mobileStopped | 15.65 |    55 |         19% |
| mobileDriving | 15.40 |    59 |         24% |
| mobileFast    | 15.15 |    61 |         26% |

La histéresis de presentación evita saltos al acelerar o frenar y trata la reversa con la misma
distancia de cámara. Calidad baja limita el pitch a 58 grados, pantallas compactas a 61 y escritorio
a 62.

## Frecuencia y encuadre

- Escritorio: actualizacion cada 33–45 ms y transicion de 40–60 ms segun perfil.
- Dispositivo tactil: actualizacion cada 40–50 ms y transicion de 45–60 ms.
- Movimiento reducido: actualizacion directa sin animacion.

El offset usa un porcentaje del alto y se limita segun perfil. El vehiculo queda debajo del centro
y deja mas mapa visible por delante. El bearing visual se suaviza y limita a ±12 grados. Un cambio
de tamano recalcula el offset sin recrear MapLibre.

## Control manual

Una interaccion original de arrastre, zoom, rotacion o inclinacion desactiva el seguimiento. El
boton de centrar lo reactiva con una transicion de 260 ms. El seguimiento normal usa `jumpTo`; solo
el recentrado usa `easeTo`, por lo que no se encadenan animaciones cortas. Cargar o reiniciar la
partida reposiciona la camara de inmediato sobre el runtime restaurado.

Los atributos `data-follow-*`, `data-current-camera-profile`, coste actual/promedio,
actualizaciones por segundo e interrupciones se actualizan de forma imperativa para E2E y no
provocan renders de React.

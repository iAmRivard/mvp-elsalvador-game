# Balance de combustible v0.2.3

## Fórmula

El consumo usa exclusivamente distancia geográfica aplicada:

```text
consumo = distanciaGeográfica × 0.0009 × superficie × ruta × turbo
```

La escala geográfica de viaje ya está incluida en la distancia producida por movimiento y no se
vuelve a multiplicar. Turbo usa `1.35×`; offroad usa `1.75×`. Las partidas nuevas comienzan en 75%;
los guardados v1/v2 conservan el valor que tenían.

## Simulación del capítulo

Las rutas provienen del grafo local de 17,048 nodos y 23,019 aristas.

| Tramo                     | Distancia | Combustible restante |
| ------------------------- | --------: | -------------------: |
| Inicio                    |         — |                75.0% |
| San Salvador → Repetidor  | 15.716 km |                60.9% |
| Repetidor → bloqueo       |  7.739 km |                53.9% |
| Bloqueo → estación, norte | 30.795 km |                28.4% |
| Bloqueo → estación, sur   | 30.288 km |                19.8% |
| Bidón +45%, norte         |         — |                73.4% |
| Bidón +45%, sur           |         — |                64.8% |

En 20 km, usar Turbo durante 20% del trayecto eleva el consumo de 18.0 a 19.3 puntos. El mismo tramo
completamente offroad consume 31.5 puntos. Las pruebas cubren ambos perfiles y rutas.

## Estimaciones y recuperación

`estimateFuelRange()` devuelve metros aproximados según superficie actual.
`estimateFuelAtDestination()` aplica distancia, perfil de ruta, Turbo y offroad. El panel muestra
**Suficiente**, **Justo** o **Combustible insuficiente**, sin presentarlo como cálculo exacto.

Si la ruta estimada no alcanza, el panel ofrece volver al checkpoint. Al llegar a cero, recuperación
permite regresar al último punto seguro con hasta 20% de combustible de emergencia. También se
puede abandonar la misión. Estas rutas de salida evitan un guardado imposible de continuar.

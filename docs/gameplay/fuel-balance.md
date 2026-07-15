# Balance de combustible v0.2.4.1

## Fórmula

El consumo usa exclusivamente distancia geográfica aplicada:

```text
consumo = distanciaGeográfica × 0.0009 × superficie × ruta × turbo
```

La escala geográfica de viaje ya está incluida en la distancia producida por movimiento y no se
vuelve a multiplicar. Turbo usa `1.35×`; offroad usa `1.75×`. Las partidas nuevas comienzan en 75%;
los guardados v1/v2 conservan el valor que tenían.

## Simulación del capítulo

Las rutas provienen del grafo local de 17,083 nodos y 23,054 aristas.

| Tramo                         | Distancia | Combustible restante |
| ----------------------------- | --------: | -------------------: |
| Inicio                        |         — |                75.0% |
| San Salvador → Repetidor      | 15.716 km |                60.9% |
| Repetidor → bloqueo           |  7.739 km |                53.9% |
| Bloqueo → estación, norte     | 30.795 km |                28.4% |
| Bloqueo → estación, sur       | 30.288 km |                19.8% |
| Recarga de misión +45%, norte |         — |                73.4% |
| Recarga de misión +45%, sur   |         — |                64.8% |

En 20 km, usar Turbo durante 20% del trayecto eleva el consumo de 18.0 a 19.3 puntos. El mismo tramo
completamente offroad consume 31.5 puntos. Las pruebas cubren ambos perfiles y rutas.

## Estimaciones y recuperación

`estimateFuelRange()` devuelve metros aproximados según superficie actual.
`estimateFuelAtDestination()` aplica distancia, perfil de ruta, Turbo y offroad. El panel muestra
**Suficiente**, **Justo** o **Combustible insuficiente**, sin presentarlo como cálculo exacto.

## Puntos de abastecimiento

San Salvador, Las Delicias y El Congo tienen puntos narrativos activos del capítulo 1. Por encima de
35% sólo queda el indicador normal. Entre 25–35% aparece un chip discreto e interactivo con estación
y distancia. Por debajo de 25% aparece **Combustible bajo**, distancia, **Marcar ruta** y bidón.

El destino temporal guarda sólo tipo e ID en el formato v4; no sustituye la misión. Al cargar se
valida y A* se recalcula. Si ya no está disponible, vuelve al objetivo de misión con aviso. Dentro
de 180 m y a no más de 2 km/h, **Recargar** agrega hasta 45%, crea un checkpoint seguro y restaura la
ruta de misión.

El bidón consumible agrega hasta 30%. Puede usarse bajo 25% o desde el diálogo de 0%, donde también
se ofrece recargar si el vehículo ya está dentro de una estación. Si ninguna opción está disponible,
recuperación permite regresar al último punto seguro con hasta 20% de emergencia, reintentar o
abandonar la misión. Estas salidas evitan un guardado imposible de continuar.

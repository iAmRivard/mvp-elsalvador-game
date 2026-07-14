# Flujo narrativo v0.2.3

## Regla de experiencia

El capítulo sigue siempre esta secuencia:

```text
Historia clara → objetivo inmediato → acción comprensible → consecuencia visible → siguiente misión
```

`getRecommendedMission()` mantiene una respuesta visible sobre qué hacer después. Ninguna misión se
inicia automáticamente: el jugador confirma **Iniciar misión** o solicita una ruta a su comienzo.

## Primera transición

1. **La transmisión** presenta una señal de auxilio que viene del occidente y una advertencia sobre
   la carretera principal.
2. El jugador usa `E` o el botón **Escuchar señal**, sigue la ruta cian y registra la transmisión.
3. La tarjeta de recompensa explica que la señal continúa a Santa Ana y ofrece **Iniciar Camino
   bloqueado** porque ambas misiones comparten el Repetidor de Las Delicias.
4. **Camino bloqueado** usa una radio breve, llegada automática al cierre, inspección manual,
   elección norte/sur, cuenta `3-2-1` y un trayecto cronometrado hasta El Congo.

La tarjeta de finalización incluye resumen, recompensas, consecuencia de ruta y acceso a Bitácora.

## Presentaciones

| Presentación         | Pausa | Bloquea mapa | Uso                                  |
| -------------------- | ----- | ------------ | ------------------------------------ |
| `radio`              | no    | no           | mensajes normales y objetivos breves |
| `chapter`            | sí    | sí           | introducción y final de capítulo     |
| elección             | sí    | sí           | decisión con consecuencias           |
| recuperación         | sí    | sí           | fallo, combustible o condición       |
| tutorial obligatorio | sí    | sí           | primera guía de controles            |

Todo bloqueo muestra **JUEGO EN PAUSA**. `RadioMessageOverlay` deja el backdrop sin eventos de
puntero, recibe eventos únicamente en la tarjeta, cierra manualmente o a los 12 segundos y registra
el texto en la Bitácora.

## Bitácora

- **Historia** muestra todos los registros en orden inverso.
- **Misiones** guarda inicios, elecciones y resultados.
- **Radio** conserva cada transmisión y su objetivo explicado.
- **Lugares** conserva los descubrimientos.

Los registros usan orden determinista (`Registro 01`, `Registro 02`, etc.) para evitar timestamps
inestables en pruebas y guardados.

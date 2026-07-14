# Interacciones

## Entradas

- `E` es la tecla principal.
- `Espacio` permanece como fallback compatible.
- El CTA del panel admite mouse.
- El botón contextual de controles táctiles usa la misma acción.

`interactionLabelForObjective()` produce textos concretos como **Escuchar señal**, **Inspeccionar
bloqueo**, **Recoger bidón**, **Instalar relé**, **Recargar combustible** o **Elegir desvío**.

La entrada manual se procesa por flanco: una pulsación produce una acción aunque el pulso táctil
dure varios frames. Esto evita que una misma pulsación inspeccione el bloqueo y acepte la acción
siguiente.

## Acciones automáticas

- `arrive` y `explore` al entrar en el radio.
- Descubrimientos al entrar en su radio.
- Llegada al inicio recomendado, que habilita el CTA pero no inicia la misión.
- `collect` dentro del radio, con objeto disponible y velocidad inferior a 5 km/h.

## Acciones manuales

- Escuchar, inspeccionar y registrar.
- Reparar o instalar piezas.
- Recargar combustible.
- Entregar o activar mecanismos.
- Abrir y confirmar una decisión.

Los botones contextuales desaparecen al salir del radio. Cada acción emite una respuesta breve,
como **Objetivo actualizado**, **Ruta recalculada**, **Bidón recogido**, **Combustible +45%**,
**Condición -8%** o **Checkpoint guardado**.

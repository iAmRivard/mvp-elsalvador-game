# Progresion, inventario y checkpoints

## Inventario

El inventario es una lista pequena de `{ itemId, quantity }`. Las definiciones viven en
`src/data/items.ts` y fijan nombre, descripcion, tipo y cantidad maxima. Las funciones puras de
`src/game/inventory.ts` agregan, consumen, consultan requisitos y sanean datos cargados. No existe
peso, economia, fabricacion ni almacenamiento remoto.

Los objetos desconocidos se descartan al cargar. Un consumo solo tiene exito si existe la cantidad
completa, y agregar nunca supera el maximo de la definicion. El boton de inventario de la barra
superior muestra el contenido sin pausar ni modificar objetos.

## Objetivos

El motor admite `arrive`, `explore`, `interact`, `collect`, `deliver`, `repair`, `refuel`, `timed` y
`choice`. En v0.2, recoleccion, reparacion, carga y tiempo tienen efectos completos:

- `collect` requiere interaccion y agrega el objeto configurado.
- `repair` valida pieza y energia antes de consumirlas y restaurar condicion.
- `refuel` requiere interaccion, puede consumir un bidon y respeta la capacidad maxima.
- `timed` acumula segundos de game loop, completa al alcanzar el punto y falla al agotar el plazo.

El progreso de cada objetivo incluye valor, meta, tiempo transcurrido y duracion. La bitacora muestra
cantidades o segundos restantes, el guardado los conserva y teclado/tactil comparten la accion de
interaccion.

`prerequisiteObjectiveIds` permite secuencias y ramas pequenas dentro de una mision. Un objetivo no
disponible no inicia tiempo, no recibe interaccion y no se convierte en destino de ruta. El motor
busca el pendiente disponible mas cercano, por lo que la estacion permite recoger dos objetos en
cualquier orden y Coatepeque exige completar sus tres ecos antes de mostrar la baliza.

## Checkpoints

Se crea un checkpoint al iniciar mision, entrar a una ciudad o estacion y completar un objetivo. Las
estaciones actualizan ademas el lugar seguro. Reintentar restaura exactamente el snapshot; volver a
un lugar seguro puede conservar la mision del snapshot o abandonarla. Ninguna recuperacion borra
experiencia, misiones completadas, descubrimientos ni historias.

El store conserva snapshots pequenos. La red vial, sus indices y la geometria de rutas permanecen
fuera de Zustand y de `localStorage`.

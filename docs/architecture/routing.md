# Rutas locales con A*

`LocalRoutingService` implementa rutas sin backend. La pantalla inicial prepara un Web Worker con
una copia transferida del JSON vial; el grafo, el índice de routing y la caché permanecen allí. Si
Worker no está disponible o falla, el servicio reutiliza la red del hilo principal como fallback.

## Ajuste de extremos

Origen y destino se proyectan sobre una carretera en un radio máximo de 2 km. Cada proyección crea
candidatos virtuales hacia los extremos permitidos de la arista. Una vía de un solo sentido solo
permite avanzar de `from` a `to`; una vía bidireccional crea ambos sentidos. La geometría parcial se
conserva para que la línea comience en la posición real y siga las curvas del tramo.

Si un extremo no tiene cobertura, el servicio retorna `null`. La misión dibuja una línea directa
discontinua con estado `fallback`; el objetivo nunca queda bloqueado por falta de corredor vial.

## Costo y caché

Cada arco cuesta `distancia / multiplicador de velocidad`. A* usa distancia geodésica dividida por
1.25 como heurística admisible. Aristas bloqueadas o temporalmente cerradas se excluyen y las
penalizaciones multiplican el costo con mínimo 1. La cola de prioridad es un heap binario.

La caché LRU admite 32 entradas. Su clave incluye versión y origen de la red, versión del perfil de
costo, coordenadas redondeadas, bloqueos, cierres y penalizaciones. Cambiar cualquiera de esos datos
invalida la coincidencia; un hit se mueve al final y la entrada más antigua se elimina al superar el
límite.

## Protocolo del worker

Las solicitudes `load-road-network`, `build-index`, `calculate-route` y `cancel-route` llevan un ID
único. El cliente mantiene una sola ruta activa: al recibir una nueva, rechaza la anterior, envía
cancelación lógica y descarta cualquier respuesta tardía. Un timeout de 4 s cancela la operación y
activa el fallback local. Se registran tiempo puro del worker, nodos expandidos, hits, entradas,
timeouts y respuestas antiguas.

El worker recibe el buffer vial una sola vez mediante transferencia. Decodifica, parsea, valida,
construye índice y router, y conserva esas estructuras para consultas posteriores; no devuelve el
grafo al hilo principal ni lo transfiere por cada misión.

## Ciclo de recálculo

La ruta se calcula al iniciar misión, cambiar objetivo o cierres, pulsar `R` o usar el botón de la
bitácora. La desviación se revisa una vez por segundo; superar 250 m activa un cálculo solo si
pasaron al menos cinco segundos. Un token local y el `requestId` del worker impiden aplicar rutas de
un objetivo anterior.

MapLibre diferencia ruta vial sólida y fallback discontinuo, resalta el segmento inmediato y coloca
una flecha hacia la próxima maniobra. La bitácora muestra cálculo, aviso fuera de ruta, distancia,
duración y estado de recálculo sin bloquear conducción, cámara o audio.

## Navegación

`generateNavigationInstructions` analiza cambios de heading de la geometría y produce `continue`,
`slight-left`, `slight-right`, `turn-left`, `turn-right`, `u-turn` y `arrive`. Fusiona cambios
menores y separa maniobras cercanas para no anunciar cada curva del trazado.

Durante el movimiento se proyecta el jugador sobre la ruta, se elige la siguiente instrucción y se
calcula su distancia restante. La instrucción visible cambia entre continuar, girar, llegar, fuera
de ruta y calculando. No hay navegación por voz en v0.2.1.

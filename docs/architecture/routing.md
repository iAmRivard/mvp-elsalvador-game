# Rutas locales con A*

`LocalRoutingService` implementa el contrato asíncrono de rutas sin consultar un backend. Reutiliza
la red y el índice cargados por `loadRoadNetwork`; el grafo y sus resultados no entran en Zustand ni
en el guardado.

## Ajuste de extremos

Origen y destino se proyectan sobre una carretera en un radio máximo de 2 km. Cada proyección crea
candidatos virtuales hacia los extremos permitidos de la arista. Una vía de un solo sentido solo
permite avanzar de `from` a `to`; una vía bidireccional crea ambos sentidos. La geometría parcial se
conserva para que la línea comience en la posición real y continúe sobre las curvas del tramo.

Si uno de los extremos no tiene cobertura, el servicio retorna `null`. La capa de misión conserva
entonces una línea directa marcada internamente como `fallback`; la misión nunca queda bloqueada.

## Costo y búsqueda

Cada arco cuesta `distancia / multiplicador de velocidad`. A* usa como heurística la distancia
geodésica dividida por 1.25, el multiplicador máximo, por lo que no sobreestima. Las aristas
bloqueadas o temporalmente cerradas se excluyen; las penalizaciones multiplican el costo con un
valor mínimo de 1. La cola de prioridad es un heap binario local.

El resultado incluye geometría, distancia, duración estimada con la escala de viaje y los IDs de
arista recorridos. Se guardan hasta 32 consultas recientes con coordenadas redondeadas, cierres y
penalizaciones en la clave. Las métricas reportan cálculos, aciertos de caché, duración media y nodos
expandidos.

## Ciclo de recálculo

La ruta se calcula al iniciar misión, cambiar objetivo, cambiar cierres o solicitar recálculo desde
el botón de la bitácora o la tecla `R`. La desviación se revisa una vez por segundo; superar 250 m
activa un nuevo cálculo solo si pasaron al menos cinco segundos. No se ejecuta A* en cada entrega de
telemetría.

MapLibre dibuja rutas viales como línea sólida con contorno oscuro y el fallback como línea
discontinua. La bitácora muestra distancia sobre carretera, duración aproximada y estado
provisional cuando corresponde.

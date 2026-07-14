# Capítulo 1: La señal de Occidente

El primer capítulo es un recorrido continuo desde San Salvador hasta Coatepeque. Sus ocho tramos
largos tienen entre 12 y 25 minutos de conducción estimada con la escala de viaje actual; lectura,
interacción y exploración sitúan una primera partida dentro del objetivo de 15 a 25 minutos.

## Secuencia

| Misión                   | Inicio       | Sistemas introducidos                      | Resultado                               |
| ------------------------ | ------------ | ------------------------------------------ | --------------------------------------- |
| La transmisión           | San Salvador | Interacción, cámara, ruta y combustible    | Registra el repetidor de Las Delicias   |
| Camino bloqueado         | Las Delicias | Cierre, recálculo, vía secundaria y tiempo | Abre la estación de El Congo            |
| Estación abandonada      | El Congo     | Recolección, inventario y carga            | Obtiene combustible y un relé           |
| Reparación de emergencia | El Congo     | Condición, pieza y costo de energía        | Restaura 45 puntos de condición         |
| Llegada a Santa Ana      | El Congo     | Punto seguro y recompensa narrativa        | Desbloquea Coatepeque                   |
| Ecos de Coatepeque       | Santa Ana    | Exploración múltiple, agua y baliza        | Completa el capítulo y abre Cerro Verde |

`senales-en-suchitoto` permanece como misión opcional y como ejemplo deliberado del fallback fuera
del corredor vial occidental.

## Progresión de objetivos

Cada objetivo puede declarar `prerequisiteObjectiveIds`. Un objetivo bloqueado no aparece como
acción cercana, no inicia su temporizador y no se usa como destino de ruta hasta cumplir sus
dependencias. En la estación, el bidón y el relé se pueden recoger en cualquier orden después de
investigar; la carga exige y consume el bidón. La reparación exige el relé, consume 15 de energía y
fuerza la condición a un máximo inicial de 55 para que el efecto sea observable.

La misión del bloqueo cierra temporalmente la arista `14072` al completar la inspección. El servicio
A* invalida la ruta, excluye esa arista y encuentra un desvío más largo. El cierre se reconstruye al
cargar una partida activa y se elimina al abandonar o recuperar la misión.

En Coatepeque, los tres puntos de exploración están sobre accesos viales y fuera de la máscara de
agua. La baliza final sólo se habilita después de visitar los tres. Al completarla se guarda
`chapter-1`, se crea un checkpoint seguro, se desbloquea Cerro Verde y se muestra el cierre
narrativo.

## Eventos y guardado

Cada misión inicia con un mensaje breve de radio. Hay un evento adicional al confirmar el bloqueo y
otro al cerrar el capítulo. Los paneles pausan el movimiento, se descartan con una acción explícita
y se registran como historia desbloqueada cuando corresponde.

El progreso usa el guardado v3: misión activa, objetivos, elección, progreso temporal, inventario,
condición, cierres reconstruibles, capítulo y checkpoints. La migración de partidas anteriores
conserva los IDs históricos de las misiones y expande los prerrequisitos para que una partida que ya
había llegado a Coatepeque no quede bloqueada.

## Validación

`tests/chapterRoutingIntegration.test.ts` recorre los ocho tramos largos con el grafo real, verifica
el desvío del cierre y comprueba que ninguna ruta del lago entre en agua. El flujo Playwright recoge
el bidón y el relé, carga combustible, repara el vehículo, consume inventario y completa ambas
misiones en escritorio, móvil vertical y móvil horizontal.

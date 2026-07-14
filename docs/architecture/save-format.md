# Formato de guardado local

La partida se almacena en `localStorage` bajo la clave
`el-salvador-rutas-perdidas:save`. No se envía información a un servidor.

## Versión actual

La versión actual es `2` y utiliza este sobre:

```json
{
  "version": 2,
  "savedAt": "2026-07-13T16:00:00.000Z",
  "game": {
    "player": {},
    "energy": 100,
    "maxEnergy": 100,
    "experience": 0,
    "inventory": [],
    "vehicle": {
      "condition": 100,
      "fuel": 100,
      "maximumFuel": 100
    },
    "lastCheckpoint": {},
    "lastSafeCheckpoint": {},
    "currentChapterId": "chapter-1",
    "completedChapterIds": [],
    "roadNetworkVersion": 1
  }
}
```

`game` contiene el runtime mínimo del jugador, misión activa, progreso de cada objetivo, ubicaciones,
inventario, vehículo, checkpoints, capítulo, historia, pausa y seguimiento de cámara. La velocidad
se restaura en cero para evitar que el vehículo continúe moviéndose al cargar. El grafo vial no se
guarda: sólo se registra su versión y se vuelve a cargar desde el archivo estático.

Los cierres narrativos tampoco duplican IDs de aristas en el documento. Se reconstruyen de forma
determinista a partir de la misión y sus objetivos completados, por lo que una partida guardada
durante **Camino bloqueado** conserva el desvío al cargar. Los paneles de radio activos no se
persisten; sus historias desbloqueadas sí.

Cada checkpoint conserva posición, combustible, condición, inventario, energía, misión, objetivos
completados y progreso parcial. `lastCheckpoint` permite reintentar una misión y
`lastSafeCheckpoint` vuelve a una ciudad o estación sin borrar el resto de la expedición.

## Escritura y carga

- El estado se hidrata antes de montar el mapa.
- El autosave agrupa cambios y escribe como máximo una vez cada 1,5 segundos mientras hay cambios.
- Cambiar de pestaña o cerrar la página fuerza una última escritura pendiente.
- El menú `▣` permite guardar y cargar manualmente.
- Reiniciar borra el guardado y restaura la expedición inicial; el autosave puede crear luego un
  nuevo guardado inicial.

## Validación y migración

Al cargar se normalizan rumbo, combustible, energía, distancia y límites geográficos. También se
descartan identificadores de misiones, objetivos y ubicaciones que no existan en los datos actuales.
Las ubicaciones inicialmente disponibles siempre se restituyen.

Los estados planos sin versión y los marcados como versión `0` se migran al contrato actual. La
migración explícita de versión `1` conserva posición, experiencia, misiones, ubicaciones, historias
y preferencias independientes; agrega inventario vacío, condición completa, checkpoints derivados,
capítulo 1 y versión vial 1. Los objetos especiales conocidos se trasladan también al inventario.
Una versión futura desconocida o un JSON inválido se rechaza sin reemplazar la partida en memoria.

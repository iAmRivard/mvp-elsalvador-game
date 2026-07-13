# Formato de guardado local

La partida se almacena en `localStorage` bajo la clave
`el-salvador-rutas-perdidas:save`. No se envía información a un servidor.

## Versión actual

La versión actual es `1` y utiliza este sobre:

```json
{
  "version": 1,
  "savedAt": "2026-07-13T16:00:00.000Z",
  "game": {
    "player": {},
    "energy": 100,
    "maxEnergy": 100,
    "experience": 0
  }
}
```

`game` contiene el runtime mínimo del jugador, estado de misiones, ubicaciones descubiertas y
desbloqueadas, objetos, historia, pausa y seguimiento de cámara. La velocidad se restaura en cero
para evitar que el vehículo continúe moviéndose al cargar.

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

Los estados planos sin versión y los marcados como versión `0` se migran al contrato actual. Una
versión futura desconocida o un JSON inválido se rechaza sin reemplazar la partida en memoria.

# Progresión de misiones

## Recomendación

`src/game/missionRecommendations.ts` implementa la función pura `getRecommendedMission()`.

Prioridades:

1. Reanudar la misión activa.
2. Recomendar la primera misión principal incompleta de `chapterOneMissionIds`.
3. Recomendar una opcional sólo cuando no desplaza la historia principal.
4. Permitir inicio si el jugador está dentro del radio del lugar inicial.
5. En caso contrario, enrutar al lugar inicial sin iniciar la misión.

El panel muestra primero la recomendación, después las opcionales, un grupo contraído de próximas
misiones con su causa y un grupo de completadas. En móvil contraído permanece un CTA compacto.

## Continuar historia

Al completar una misión, `MissionToast` calcula otra vez la recomendación:

- **Iniciar _misión_** cierra la recompensa, inicia la misión, activa ruta y narrativa.
- **Ir al inicio de _misión_** cierra la recompensa y crea la ruta al punto de inicio.
- **Ver bitácora** abre directamente la sección Misiones.

## Elección de Camino bloqueado

La elección sólo se abre con una nueva interacción después de inspeccionar el cierre.

| Opción | Cierres          | Distancia A* | Consumo |               Condición |
| ------ | ---------------- | -----------: | ------: | ----------------------: |
| Norte  | `14072`, `14336` |    30.795 km | `0.92×` | menor, -2% al completar |
| Sur    | `14072`          |    30.288 km | `1.25×` | mayor, -8% al completar |

La selección se guarda en `missionChoiceSelections`, modifica cierres y recálculo A*, aparece en la
Bitácora y no puede elegirse otra vez. El guardado v3 conserva selección y progreso temporal.

## Tiempo y checkpoints

El objetivo de 270 segundos no avanza mientras se lee la elección. Al confirmar se completa el
objetivo `choice`, se muestra `3-2-1` y sólo después comienza el tiempo. Pausa, modal obligatorio y
recuperación detienen el game loop.

El checkpoint anterior a la elección se conserva intencionalmente. Si el tiempo llega a cero,
**Reintentar checkpoint** restaura inspección completada, elimina la elección y reinicia el tiempo;
el jugador puede escoger otra ruta.

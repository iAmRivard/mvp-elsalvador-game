export const CHAPTER_ONE_ID = 'chapter-1';
export const CHAPTER_ONE_TITLE = 'La señal de Occidente';

export const chapterOneMissionIds = [
  'la-transmision',
  'camino-hacia-santa-ana',
  'estacion-abandonada',
  'reparacion-de-emergencia',
  'llegada-a-santa-ana',
  'secreto-de-coatepeque',
] as const;

export const chapterOneFinalMissionId = 'secreto-de-coatepeque';

export interface NarrativeEvent {
  id: string;
  channel: string;
  title: string;
  speaker: string;
  message: string;
  actionLabel: string;
}

export const narrativeEvents: readonly NarrativeEvent[] = [
  {
    id: 'radio-transmision-inicial',
    channel: 'Frecuencia 87.9 / Señal inestable',
    title: 'Una voz entre la estática',
    speaker: 'Transmisión desconocida',
    message:
      '...occidente... repite el patrón... si alguien escucha, siga la portadora antes de que cambie.',
    actionLabel: 'Sintonizar',
  },
  {
    id: 'radio-ruta-occidental',
    channel: 'Bitácora de ruta',
    title: 'La señal cruza la cordillera',
    speaker: 'Operador de campo',
    message:
      'El pulso continúa hacia Santa Ana. La carretera principal es la única lectura estable por ahora.',
    actionLabel: 'Salir al oeste',
  },
  {
    id: 'radio-bloqueo-confirmado',
    channel: 'Alerta vial local',
    title: 'Camino interrumpido',
    speaker: 'Sistema de navegación',
    message:
      'El tramo principal quedó cerrado. La red local encontró una vía secundaria; recalculando sin conexión externa.',
    actionLabel: 'Tomar el desvío',
  },
  {
    id: 'radio-estacion-abandonada',
    channel: 'Frecuencia 87.9 / Eco cercano',
    title: 'La estación sigue emitiendo',
    speaker: 'Transmisión desconocida',
    message:
      'No hay personal, pero la interferencia nace bajo el techo de la estación. Busca combustible y una pieza útil.',
    actionLabel: 'Registrar la estación',
  },
  {
    id: 'radio-averia-encendido',
    channel: 'Diagnóstico del vehículo',
    title: 'Encendido inestable',
    speaker: 'Sistema de expedición',
    message:
      'El desvío dañó el circuito de encendido. El relé recuperado puede restaurarlo usando energía de reserva.',
    actionLabel: 'Preparar reparación',
  },
  {
    id: 'radio-rumbo-santa-ana',
    channel: 'Bitácora de ruta',
    title: 'Último tramo hacia Santa Ana',
    speaker: 'Operador de campo',
    message:
      'El vehículo vuelve a responder. Santa Ana es el punto seguro más cercano y la señal gana intensidad.',
    actionLabel: 'Continuar',
  },
  {
    id: 'radio-ecos-coatepeque',
    channel: 'Frecuencia 87.9 / Tres ecos',
    title: 'La caldera devuelve la señal',
    speaker: 'Transmisión desconocida',
    message:
      'Santa Ana sólo repetía la frecuencia. Tres ecos rodean Coatepeque; la fuente real está entre ellos.',
    actionLabel: 'Seguir los ecos',
  },
  {
    id: 'final-senal-occidente',
    channel: 'Capítulo 1 completado',
    title: 'La señal de Occidente',
    speaker: 'Registro recuperado',
    message:
      'La baliza no nació en Santa Ana. Reenvía una transmisión más antigua desde las alturas de Cerro Verde. La siguiente ruta ya está abierta.',
    actionLabel: 'Cerrar bitácora',
  },
] as const;

export const narrativeEventById = new Map(
  narrativeEvents.map((event) => [event.id, event]),
);

const missionStartEventIds: Readonly<Record<string, string>> = {
  'la-transmision': 'radio-transmision-inicial',
  'camino-hacia-santa-ana': 'radio-ruta-occidental',
  'estacion-abandonada': 'radio-estacion-abandonada',
  'reparacion-de-emergencia': 'radio-averia-encendido',
  'llegada-a-santa-ana': 'radio-rumbo-santa-ana',
  'secreto-de-coatepeque': 'radio-ecos-coatepeque',
};

const objectiveEventIds: Readonly<Record<string, string>> = {
  'camino-hacia-santa-ana:inspeccionar-bloqueo': 'radio-bloqueo-confirmado',
};

const westernRoadClosureEdgeIds = [14_072] as const;

export function missionStartNarrativeEventId(missionId: string): string | null {
  return missionStartEventIds[missionId] ?? null;
}

export function objectiveNarrativeEventId(
  missionId: string,
  newlyCompletedObjectiveIds: readonly string[],
): string | null {
  for (const objectiveId of newlyCompletedObjectiveIds) {
    const eventId = objectiveEventIds[`${missionId}:${objectiveId}`];
    if (eventId) return eventId;
  }
  return null;
}

export function missionCompletionNarrativeEventId(
  missionId: string,
): string | null {
  return missionId === chapterOneFinalMissionId
    ? 'final-senal-occidente'
    : null;
}

export function missionStartConditionMaximum(missionId: string): number | null {
  return missionId === 'reparacion-de-emergencia' ? 55 : null;
}

export function chapterRoadClosureEdgeIds(
  missionId: string | null,
  completedObjectiveIds: readonly string[],
): number[] {
  if (
    missionId !== 'camino-hacia-santa-ana' ||
    !completedObjectiveIds.includes('inspeccionar-bloqueo')
  ) {
    return [];
  }
  return [...westernRoadClosureEdgeIds];
}

export function isChapterOneFinalMission(missionId: string): boolean {
  return missionId === chapterOneFinalMissionId;
}

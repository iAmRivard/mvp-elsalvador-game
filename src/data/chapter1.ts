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
  presentation: 'radio' | 'modal' | 'chapter';
  channelLabel: string;
  title: string;
  speaker: string;
  message: string;
  objectiveSummary?: string;
  actionLabel?: string;
}

export const narrativeEvents: readonly NarrativeEvent[] = [
  {
    id: 'radio-transmision-inicial',
    presentation: 'chapter',
    channelLabel: 'Capítulo 1 · La señal de Occidente',
    title: 'Una señal de auxilio',
    speaker: 'Voz desconocida',
    message:
      'Una señal de auxilio apareció en una frecuencia abandonada. Parece venir desde el occidente de El Salvador. Tu misión es seguirla, descubrir quién la envía y registrar lo que encuentres. “Si alguien puede escucharme… no sigan la carretera principal.”',
    objectiveSummary: 'Acércate al marcador de radio y escucha la señal.',
    actionLabel: 'Comenzar investigación',
  },
  {
    id: 'radio-ruta-occidental',
    presentation: 'radio',
    channelLabel: 'Radio de emergencia · 87.9',
    title: 'La señal continúa al oeste',
    speaker: 'Sistema de expedición',
    message:
      'La señal es más clara fuera de la capital. La ruta cian conduce al repetidor de Las Delicias, donde podrás registrar su origen.',
    objectiveSummary: 'Sigue la ruta cian hasta el repetidor marcado.',
    actionLabel: 'Cerrar',
  },
  {
    id: 'radio-camino-bloqueado',
    presentation: 'radio',
    channelLabel: 'Radio de emergencia · 87.9',
    title: 'Advertencia en la carretera',
    speaker: 'Voz desconocida',
    message:
      'La señal continúa hacia Santa Ana, pero la advertencia es clara: la carretera principal está bloqueada. Acércate al cierre y averigua qué ocurrió.',
    objectiveSummary: 'Sigue la ruta hasta el bloqueo de la carretera.',
    actionLabel: 'Cerrar',
  },
  {
    id: 'radio-bloqueo-confirmado',
    presentation: 'radio',
    channelLabel: 'Navegación local',
    title: 'Dos desvíos disponibles',
    speaker: 'Sistema de navegación',
    message:
      'El cierre no puede cruzarse. La red local encontró una ruta norte más estable y una ruta sur más corta, pero de mayor desgaste.',
    objectiveSummary: 'Detén el vehículo y elige un desvío.',
    actionLabel: 'Cerrar',
  },
  {
    id: 'radio-estacion-abandonada',
    presentation: 'radio',
    channelLabel: 'Radio de emergencia · Eco cercano',
    title: 'La estación sigue emitiendo',
    speaker: 'Transmisión desconocida',
    message:
      'No hay personal, pero la interferencia nace bajo el techo de la estación. Busca combustible y una pieza útil.',
    objectiveSummary: 'Investiga la estación y recupera suministros.',
    actionLabel: 'Registrar la estación',
  },
  {
    id: 'radio-averia-encendido',
    presentation: 'radio',
    channelLabel: 'Diagnóstico del vehículo',
    title: 'Encendido inestable',
    speaker: 'Sistema de expedición',
    message:
      'El desvío dañó el circuito de encendido. El relé recuperado puede restaurarlo usando energía de reserva.',
    objectiveSummary: 'Instala el relé recuperado para reparar el vehículo.',
    actionLabel: 'Preparar reparación',
  },
  {
    id: 'radio-rumbo-santa-ana',
    presentation: 'radio',
    channelLabel: 'Bitácora de ruta',
    title: 'Último tramo hacia Santa Ana',
    speaker: 'Operador de campo',
    message:
      'El vehículo vuelve a responder. Santa Ana es el punto seguro más cercano y la señal gana intensidad.',
    objectiveSummary: 'Conduce hasta el punto seguro de Santa Ana.',
    actionLabel: 'Continuar',
  },
  {
    id: 'radio-ecos-coatepeque',
    presentation: 'radio',
    channelLabel: 'Radio de emergencia · 87.9',
    title: 'La caldera devuelve la señal',
    speaker: 'Transmisión desconocida',
    message:
      'Santa Ana sólo repetía la frecuencia. La señal rebota en tres puntos alrededor de Coatepeque; revisarlos permitirá localizar la baliza.',
    objectiveSummary:
      'Explora los tres accesos marcados alrededor de Coatepeque.',
    actionLabel: 'Seguir los ecos',
  },
  {
    id: 'final-senal-occidente',
    presentation: 'chapter',
    channelLabel: 'Capítulo 1 completado',
    title: 'La señal de Occidente',
    speaker: 'Registro recuperado',
    message:
      'La baliza no nació en Santa Ana. Reenvía una transmisión más antigua desde las alturas de Cerro Verde. La siguiente ruta ya está abierta.',
    objectiveSummary: 'La investigación continuará desde Cerro Verde.',
    actionLabel: 'Cerrar bitácora',
  },
] as const;

export const narrativeEventById = new Map(
  narrativeEvents.map((event) => [event.id, event]),
);

const missionStartEventIds: Readonly<Record<string, string>> = {
  'la-transmision': 'radio-transmision-inicial',
  'camino-hacia-santa-ana': 'radio-camino-bloqueado',
  'estacion-abandonada': 'radio-estacion-abandonada',
  'reparacion-de-emergencia': 'radio-averia-encendido',
  'llegada-a-santa-ana': 'radio-rumbo-santa-ana',
  'secreto-de-coatepeque': 'radio-ecos-coatepeque',
};

const objectiveEventIds: Readonly<Record<string, string>> = {
  'la-transmision:sintonizar-transmision': 'radio-ruta-occidental',
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
  missionChoiceSelections: Readonly<Record<string, string>> = {},
): number[] {
  if (
    missionId !== 'camino-hacia-santa-ana' ||
    !completedObjectiveIds.includes('inspeccionar-bloqueo')
  ) {
    return [];
  }
  if (missionChoiceSelections[missionId] === 'north') {
    return [...westernRoadClosureEdgeIds, 14_336];
  }
  return [...westernRoadClosureEdgeIds];
}

export function isChapterOneFinalMission(missionId: string): boolean {
  return missionId === chapterOneFinalMissionId;
}

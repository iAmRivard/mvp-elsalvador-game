export type MissionObjectiveType = 'arrive' | 'explore' | 'interact';

export interface MissionObjective {
  id: string;
  type: MissionObjectiveType;
  label: string;
  targetLocationId?: string;
  coordinates?: [longitude: number, latitude: number];
  radiusMeters: number;
  requiresFuel?: boolean;
}

export type MissionReward =
  | { type: 'experience'; amount: number }
  | { type: 'fuel'; amount: number }
  | { type: 'energy'; amount: number }
  | { type: 'unlock-location'; locationId: string }
  | { type: 'item'; itemId: string; label: string }
  | { type: 'story'; storyId: string; label: string };

export interface Mission {
  id: string;
  title: string;
  description: string;
  startLocationId: string;
  destinationLocationId: string;
  objectives: readonly MissionObjective[];
  rewards: readonly MissionReward[];
  prerequisites: readonly string[];
}

export const missions: readonly Mission[] = [
  {
    id: 'camino-hacia-santa-ana',
    title: 'Camino hacia Santa Ana',
    description:
      'La primera señal occidental conduce hasta Santa Ana. Conserva combustible durante el trayecto.',
    startLocationId: 'san-salvador',
    destinationLocationId: 'santa-ana',
    objectives: [
      {
        id: 'llegar-a-santa-ana',
        type: 'arrive',
        label: 'Llega a Santa Ana sin quedarte sin combustible',
        targetLocationId: 'santa-ana',
        radiusMeters: 1_500,
        requiresFuel: true,
      },
    ],
    rewards: [
      { type: 'experience', amount: 250 },
      { type: 'fuel', amount: 30 },
      { type: 'unlock-location', locationId: 'volcan-santa-ana' },
    ],
    prerequisites: [],
  },
  {
    id: 'secreto-de-coatepeque',
    title: 'El secreto de Coatepeque',
    description:
      'Tres ecos rodean la caldera. Recorre las riberas y registra cada punto de exploración.',
    startLocationId: 'santa-ana',
    destinationLocationId: 'lago-coatepeque',
    objectives: [
      {
        id: 'mirador-norte',
        type: 'explore',
        label: 'Explora el mirador norte',
        coordinates: [-89.5495, 13.878],
        radiusMeters: 650,
      },
      {
        id: 'ribera-este',
        type: 'explore',
        label: 'Explora la ribera este',
        coordinates: [-89.5265, 13.861],
        radiusMeters: 650,
      },
      {
        id: 'ribera-sur',
        type: 'explore',
        label: 'Explora la ribera sur',
        coordinates: [-89.548, 13.847],
        radiusMeters: 650,
      },
    ],
    rewards: [
      {
        type: 'item',
        itemId: 'fragmento-de-caldera',
        label: 'Fragmento de caldera',
      },
      { type: 'experience', amount: 400 },
      { type: 'unlock-location', locationId: 'cerro-verde' },
    ],
    prerequisites: ['camino-hacia-santa-ana'],
  },
  {
    id: 'senales-en-suchitoto',
    title: 'Señales en Suchitoto',
    description:
      'Una transmisión irregular llega desde Suchitoto. Encuentra su origen e investígalo de cerca.',
    startLocationId: 'san-salvador',
    destinationLocationId: 'suchitoto',
    objectives: [
      {
        id: 'investigar-senal',
        type: 'interact',
        label: 'Investiga la señal misteriosa en Suchitoto',
        targetLocationId: 'suchitoto',
        radiusMeters: 1_000,
      },
    ],
    rewards: [
      { type: 'energy', amount: 20 },
      { type: 'experience', amount: 300 },
      {
        type: 'story',
        storyId: 'eco-del-embalse',
        label: 'El eco del embalse',
      },
    ],
    prerequisites: [],
  },
] as const;

export const missionById = new Map(
  missions.map((mission) => [mission.id, mission]),
);

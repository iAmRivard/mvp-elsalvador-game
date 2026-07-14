export type GameLocationType =
  | 'city'
  | 'town'
  | 'volcano'
  | 'lake'
  | 'beach'
  | 'forest'
  | 'ruin'
  | 'station';

export interface GameLocation {
  id: string;
  name: string;
  type: GameLocationType;
  coordinates: [longitude: number, latitude: number];
  discoveryRadiusMeters: number;
  description: string;
  department: string;
  initiallyUnlocked: boolean;
}

export const locations: readonly GameLocation[] = [
  {
    id: 'san-salvador',
    name: 'San Salvador',
    type: 'city',
    coordinates: [-89.191111, 13.6975],
    discoveryRadiusMeters: 1_500,
    description:
      'La capital funciona como centro inicial de la expedición y de la red de señales.',
    department: 'San Salvador',
    initiallyUnlocked: true,
  },
  {
    id: 'santa-ana',
    name: 'Santa Ana',
    type: 'city',
    coordinates: [-89.556667, 13.994722],
    discoveryRadiusMeters: 1_500,
    description:
      'Ciudad occidental y punto de acceso a la cordillera volcánica de Apaneca.',
    department: 'Santa Ana',
    initiallyUnlocked: true,
  },
  {
    id: 'san-miguel',
    name: 'San Miguel',
    type: 'city',
    coordinates: [-88.177222, 13.480278],
    discoveryRadiusMeters: 1_500,
    description:
      'Principal nodo del oriente, rodeado por rutas que conducen al golfo de Fonseca.',
    department: 'San Miguel',
    initiallyUnlocked: true,
  },
  {
    id: 'santa-tecla',
    name: 'Santa Tecla',
    type: 'city',
    coordinates: [-89.288611, 13.673611],
    discoveryRadiusMeters: 1_200,
    description:
      'Ciudad al pie del volcán de San Salvador y enlace entre la capital y la costa.',
    department: 'La Libertad',
    initiallyUnlocked: true,
  },
  {
    id: 'repetidor-las-delicias',
    name: 'Repetidor de Las Delicias',
    type: 'station',
    coordinates: [-89.3175451, 13.6820687],
    discoveryRadiusMeters: 650,
    description:
      'Un pequeño repetidor vial capta la transmisión que viaja hacia el occidente.',
    department: 'La Libertad',
    initiallyUnlocked: true,
  },
  {
    id: 'estacion-el-congo',
    name: 'Estación abandonada de El Congo',
    type: 'station',
    coordinates: [-89.447361, 13.8408999],
    discoveryRadiusMeters: 700,
    description:
      'Una estación cerrada conserva combustible, herramientas y rastros de interferencia.',
    department: 'Santa Ana',
    initiallyUnlocked: false,
  },
  {
    id: 'suchitoto',
    name: 'Suchitoto',
    type: 'town',
    coordinates: [-89.025833, 13.936667],
    discoveryRadiusMeters: 1_000,
    description:
      'Pueblo histórico desde el que se detectan pulsos provenientes del embalse.',
    department: 'Cuscatlán',
    initiallyUnlocked: true,
  },
  {
    id: 'el-tunco',
    name: 'El Tunco',
    type: 'beach',
    coordinates: [-89.381389, 13.492222],
    discoveryRadiusMeters: 700,
    description:
      'Playa de arena negra marcada por una formación rocosa frente al Pacífico.',
    department: 'La Libertad',
    initiallyUnlocked: true,
  },
  {
    id: 'lago-coatepeque',
    name: 'Lago de Coatepeque',
    type: 'lake',
    coordinates: [-89.546389, 13.863611],
    discoveryRadiusMeters: 2_000,
    description:
      'Lago de caldera cuyas orillas concentran varios puntos de exploración.',
    department: 'Santa Ana',
    initiallyUnlocked: false,
  },
  {
    id: 'lago-ilopango',
    name: 'Lago de Ilopango',
    type: 'lake',
    coordinates: [-89.05, 13.666667],
    discoveryRadiusMeters: 2_200,
    description:
      'Extensa caldera al este de la capital, asociada a interferencias magnéticas.',
    department: 'San Salvador',
    initiallyUnlocked: true,
  },
  {
    id: 'volcan-santa-ana',
    name: 'Volcán de Santa Ana',
    type: 'volcano',
    coordinates: [-89.63, 13.852778],
    discoveryRadiusMeters: 1_000,
    description:
      'El Ilamatepec domina el occidente; su señal permanece bloqueada al inicio.',
    department: 'Santa Ana',
    initiallyUnlocked: false,
  },
  {
    id: 'volcan-san-salvador',
    name: 'Volcán de San Salvador',
    type: 'volcano',
    coordinates: [-89.293889, 13.733889],
    discoveryRadiusMeters: 1_000,
    description:
      'El complejo volcánico vigila el área metropolitana desde el noroeste.',
    department: 'San Salvador',
    initiallyUnlocked: true,
  },
  {
    id: 'cerro-verde',
    name: 'Cerro Verde',
    type: 'forest',
    coordinates: [-89.622581, 13.826411],
    discoveryRadiusMeters: 900,
    description:
      'Bosque de altura entre volcanes, oculto hasta que avance la investigación.',
    department: 'Santa Ana',
    initiallyUnlocked: false,
  },
  {
    id: 'volcan-conchagua',
    name: 'Volcán de Conchagua',
    type: 'volcano',
    coordinates: [-87.845, 13.275],
    discoveryRadiusMeters: 1_200,
    description:
      'Atalaya oriental sobre el golfo de Fonseca y origen de una señal distante.',
    department: 'La Unión',
    initiallyUnlocked: false,
  },
] as const;

export const locationById = new Map(
  locations.map((location) => [location.id, location]),
);

export const initiallyUnlockedLocationIds = locations
  .filter((location) => location.initiallyUnlocked)
  .map((location) => location.id);

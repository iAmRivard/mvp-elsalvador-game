export type MissionObjectiveType =
  | 'arrive'
  | 'explore'
  | 'interact'
  | 'collect'
  | 'deliver'
  | 'repair'
  | 'refuel'
  | 'timed'
  | 'choice';

export interface MissionObjective {
  id: string;
  type: MissionObjectiveType;
  label: string;
  targetLocationId?: string;
  coordinates?: [longitude: number, latitude: number];
  radiusMeters: number;
  requiresFuel?: boolean;
  itemId?: string;
  quantity?: number;
  requiredItemId?: string;
  repairAmount?: number;
  refuelAmount?: number;
  durationSeconds?: number;
  energyCost?: number;
  prerequisiteObjectiveIds?: readonly string[];
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
    id: 'la-transmision',
    title: 'La transmisión',
    description:
      'Una frecuencia desconocida cruza la capital. Registra el pulso y sigue su rastro hacia el oeste.',
    startLocationId: 'san-salvador',
    destinationLocationId: 'repetidor-las-delicias',
    objectives: [
      {
        id: 'sintonizar-transmision',
        type: 'interact',
        label: 'Sintoniza la transmisión en San Salvador',
        targetLocationId: 'san-salvador',
        radiusMeters: 500,
      },
      {
        id: 'llegar-repetidor-oeste',
        type: 'arrive',
        label: 'Sigue la señal hasta el repetidor de Las Delicias',
        targetLocationId: 'repetidor-las-delicias',
        radiusMeters: 500,
        requiresFuel: true,
        prerequisiteObjectiveIds: ['sintonizar-transmision'],
      },
      {
        id: 'registrar-frecuencia-oeste',
        type: 'interact',
        label: 'Registra la frecuencia del repetidor',
        targetLocationId: 'repetidor-las-delicias',
        radiusMeters: 220,
        prerequisiteObjectiveIds: ['llegar-repetidor-oeste'],
      },
    ],
    rewards: [
      { type: 'experience', amount: 150 },
      {
        type: 'story',
        storyId: 'registro-transmision-occidente',
        label: 'Registro de la transmisión',
      },
    ],
    prerequisites: [],
  },
  {
    id: 'camino-hacia-santa-ana',
    title: 'Camino bloqueado',
    description:
      'El acceso principal está cerrado. Inspecciona el bloqueo y encuentra una salida por carreteras secundarias.',
    startLocationId: 'repetidor-las-delicias',
    destinationLocationId: 'estacion-el-congo',
    objectives: [
      {
        id: 'llegar-al-bloqueo',
        type: 'arrive',
        label: 'Llega al cierre de la carretera occidental',
        coordinates: [-89.3592277, 13.7305749],
        radiusMeters: 450,
        requiresFuel: true,
      },
      {
        id: 'inspeccionar-bloqueo',
        type: 'interact',
        label: 'Inspecciona el bloqueo',
        coordinates: [-89.3592277, 13.7305749],
        radiusMeters: 180,
        prerequisiteObjectiveIds: ['llegar-al-bloqueo'],
      },
      {
        id: 'elegir-ruta-secundaria',
        type: 'choice',
        label: 'Confirma el desvío por la vía secundaria',
        coordinates: [-89.3981679, 13.7673945],
        radiusMeters: 420,
        prerequisiteObjectiveIds: ['inspeccionar-bloqueo'],
      },
      {
        id: 'alcanzar-estacion-a-tiempo',
        type: 'timed',
        label: 'Alcanza la estación antes de perder la señal',
        targetLocationId: 'estacion-el-congo',
        radiusMeters: 550,
        durationSeconds: 210,
        requiresFuel: true,
        prerequisiteObjectiveIds: ['elegir-ruta-secundaria'],
      },
    ],
    rewards: [
      { type: 'experience', amount: 220 },
      { type: 'unlock-location', locationId: 'estacion-el-congo' },
    ],
    prerequisites: ['la-transmision'],
  },
  {
    id: 'estacion-abandonada',
    title: 'Estación abandonada',
    description:
      'La estación quedó vacía, pero todavía conserva combustible y repuestos entre la interferencia.',
    startLocationId: 'estacion-el-congo',
    destinationLocationId: 'estacion-el-congo',
    objectives: [
      {
        id: 'investigar-estacion',
        type: 'interact',
        label: 'Investiga la estación abandonada',
        targetLocationId: 'estacion-el-congo',
        radiusMeters: 180,
      },
      {
        id: 'recoger-bidon',
        type: 'collect',
        label: 'Recoge el bidón de combustible',
        coordinates: [-89.44672, 13.84092],
        radiusMeters: 65,
        itemId: 'bidon-combustible',
        quantity: 1,
        prerequisiteObjectiveIds: ['investigar-estacion'],
      },
      {
        id: 'recoger-rele',
        type: 'collect',
        label: 'Recoge el relé de encendido',
        coordinates: [-89.4479, 13.84048],
        radiusMeters: 65,
        itemId: 'rele-encendido',
        quantity: 1,
        prerequisiteObjectiveIds: ['investigar-estacion'],
      },
      {
        id: 'recargar-en-estacion',
        type: 'refuel',
        label: 'Carga el combustible recuperado',
        targetLocationId: 'estacion-el-congo',
        radiusMeters: 55,
        refuelAmount: 45,
        requiredItemId: 'bidon-combustible',
        prerequisiteObjectiveIds: ['recoger-bidon'],
      },
    ],
    rewards: [
      { type: 'experience', amount: 240 },
      { type: 'energy', amount: 10 },
    ],
    prerequisites: ['camino-hacia-santa-ana'],
  },
  {
    id: 'reparacion-de-emergencia',
    title: 'Reparación de emergencia',
    description:
      'El desvío dañó el encendido. Usa la pieza encontrada antes de continuar hacia Santa Ana.',
    startLocationId: 'estacion-el-congo',
    destinationLocationId: 'estacion-el-congo',
    objectives: [
      {
        id: 'reparar-vehiculo',
        type: 'repair',
        label: 'Instala el relé y repara el vehículo',
        targetLocationId: 'estacion-el-congo',
        radiusMeters: 190,
        requiredItemId: 'rele-encendido',
        repairAmount: 45,
        energyCost: 15,
      },
    ],
    rewards: [
      { type: 'experience', amount: 260 },
      { type: 'energy', amount: 5 },
    ],
    prerequisites: ['estacion-abandonada'],
  },
  {
    id: 'llegada-a-santa-ana',
    title: 'Llegada a Santa Ana',
    description:
      'Con el vehículo reparado, completa el trayecto y localiza la fuente parcial de la transmisión.',
    startLocationId: 'estacion-el-congo',
    destinationLocationId: 'santa-ana',
    objectives: [
      {
        id: 'llegar-a-santa-ana',
        type: 'arrive',
        label: 'Llega al punto seguro de Santa Ana',
        targetLocationId: 'santa-ana',
        radiusMeters: 1_200,
        requiresFuel: true,
      },
      {
        id: 'localizar-fuente-parcial',
        type: 'interact',
        label: 'Localiza la fuente parcial de la señal',
        coordinates: [-89.556959, 13.994583],
        radiusMeters: 220,
        prerequisiteObjectiveIds: ['llegar-a-santa-ana'],
      },
    ],
    rewards: [
      { type: 'experience', amount: 320 },
      { type: 'fuel', amount: 25 },
      { type: 'unlock-location', locationId: 'lago-coatepeque' },
      {
        type: 'story',
        storyId: 'fuente-parcial-santa-ana',
        label: 'La fuente parcial',
      },
    ],
    prerequisites: ['reparacion-de-emergencia'],
  },
  {
    id: 'secreto-de-coatepeque',
    title: 'Ecos de Coatepeque',
    description:
      'La transmisión rebota alrededor de la caldera. Recorre sus accesos sin atravesar el agua y encuentra la baliza.',
    startLocationId: 'santa-ana',
    destinationLocationId: 'lago-coatepeque',
    objectives: [
      {
        id: 'llegar-a-coatepeque',
        type: 'arrive',
        label: 'Llega al acceso norte de Coatepeque',
        coordinates: [-89.5542247, 13.9059141],
        radiusMeters: 450,
        requiresFuel: true,
      },
      {
        id: 'mirador-norte',
        type: 'explore',
        label: 'Explora el mirador norte',
        coordinates: [-89.5542247, 13.9059141],
        radiusMeters: 320,
        prerequisiteObjectiveIds: ['llegar-a-coatepeque'],
      },
      {
        id: 'ribera-este',
        type: 'explore',
        label: 'Explora la ribera este',
        coordinates: [-89.5082783, 13.8722307],
        radiusMeters: 350,
        prerequisiteObjectiveIds: ['llegar-a-coatepeque'],
      },
      {
        id: 'ribera-sur',
        type: 'explore',
        label: 'Explora la ribera sur',
        coordinates: [-89.5512194, 13.8294224],
        radiusMeters: 350,
        prerequisiteObjectiveIds: ['llegar-a-coatepeque'],
      },
      {
        id: 'investigar-baliza-coatepeque',
        type: 'interact',
        label: 'Investiga la baliza junto a la caldera',
        coordinates: [-89.5741276, 13.9043351],
        radiusMeters: 240,
        prerequisiteObjectiveIds: [
          'mirador-norte',
          'ribera-este',
          'ribera-sur',
        ],
      },
    ],
    rewards: [
      {
        type: 'item',
        itemId: 'fragmento-de-caldera',
        label: 'Fragmento de caldera',
      },
      { type: 'experience', amount: 500 },
      { type: 'unlock-location', locationId: 'cerro-verde' },
      {
        type: 'story',
        storyId: 'senal-hacia-cerro-verde',
        label: 'La señal continúa',
      },
    ],
    prerequisites: ['llegada-a-santa-ana'],
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

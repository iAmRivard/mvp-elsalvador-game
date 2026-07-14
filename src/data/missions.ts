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

export interface MissionChoiceOption {
  id: string;
  label: string;
  description: string;
  estimatedDistanceMeters: number;
  estimatedDurationSeconds: number;
  risk: 'low' | 'medium' | 'high';
  closedRoadEdgeIds?: readonly number[];
  fuelMultiplier?: number;
  conditionMultiplier?: number;
}

export interface MissionChoiceDefinition {
  prompt: string;
  options: readonly MissionChoiceOption[];
}

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
  choice?: MissionChoiceDefinition;
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
  optional?: boolean;
  completionSummary: string;
}

export const missions: readonly Mission[] = [
  {
    id: 'la-transmision',
    title: 'La transmisión',
    description:
      'Una señal de auxilio apareció en una frecuencia abandonada. Escúchala y sigue su origen hacia el occidente.',
    startLocationId: 'san-salvador',
    destinationLocationId: 'repetidor-las-delicias',
    objectives: [
      {
        id: 'sintonizar-transmision',
        type: 'interact',
        label: 'Acércate al marcador y escucha la señal',
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
        label: 'Detén el vehículo y registra la transmisión',
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
    completionSummary:
      'La señal continúa hacia Santa Ana, pero alguien advierte que la carretera principal está bloqueada.',
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
        label: 'Elige el desvío hacia la estación',
        coordinates: [-89.3592277, 13.7305749],
        radiusMeters: 180,
        prerequisiteObjectiveIds: ['inspeccionar-bloqueo'],
        choice: {
          prompt: '¿Qué ruta usarás para seguir la señal hasta la estación?',
          options: [
            {
              id: 'north',
              label: 'Ruta norte',
              description:
                'Más larga y estable. Menor consumo y menor desgaste.',
              estimatedDistanceMeters: 30_795,
              estimatedDurationSeconds: 258,
              risk: 'low',
              closedRoadEdgeIds: [14_072, 14_336],
              fuelMultiplier: 0.92,
              conditionMultiplier: 0.65,
            },
            {
              id: 'south',
              label: 'Ruta sur',
              description:
                'Más corta, por caminos secundarios en mal estado. Consume y desgasta más.',
              estimatedDistanceMeters: 30_288,
              estimatedDurationSeconds: 245,
              risk: 'high',
              closedRoadEdgeIds: [14_072],
              fuelMultiplier: 1.25,
              conditionMultiplier: 1.35,
            },
          ],
        },
      },
      {
        id: 'alcanzar-estacion-a-tiempo',
        type: 'timed',
        label: 'Alcanza la estación antes de perder la señal',
        targetLocationId: 'estacion-el-congo',
        radiusMeters: 550,
        durationSeconds: 270,
        requiresFuel: true,
        prerequisiteObjectiveIds: ['elegir-ruta-secundaria'],
      },
    ],
    rewards: [
      { type: 'experience', amount: 220 },
      { type: 'unlock-location', locationId: 'estacion-el-congo' },
    ],
    prerequisites: ['la-transmision'],
    completionSummary:
      'Llegaste a la estación antes de perder la señal. El desvío dejó consecuencias visibles en el vehículo.',
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
    completionSummary:
      'Recuperaste combustible y una pieza de encendido para continuar el viaje.',
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
    completionSummary:
      'El vehículo vuelve a responder. Santa Ana es el siguiente punto seguro.',
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
    completionSummary:
      'La señal no nació en Santa Ana: rebota desde los alrededores de Coatepeque.',
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
    completionSummary:
      'La baliza reenvía una transmisión más antigua desde Cerro Verde.',
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
    optional: true,
    completionSummary:
      'La señal de Suchitoto quedó registrada como una transmisión secundaria.',
  },
] as const;

export const missionById = new Map(
  missions.map((mission) => [mission.id, mission]),
);

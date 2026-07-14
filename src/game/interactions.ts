import type { MissionObjective } from '../data/missions';

const objectiveLabels: Readonly<Record<string, string>> = {
  'sintonizar-transmision': 'Escuchar señal',
  'registrar-frecuencia-oeste': 'Registrar señal',
  'inspeccionar-bloqueo': 'Inspeccionar bloqueo',
  'elegir-ruta-secundaria': 'Elegir desvío',
  'investigar-estacion': 'Investigar estación',
  'recoger-bidon': 'Recoger bidón',
  'recoger-rele': 'Recoger relé',
  'recargar-en-estacion': 'Recargar combustible',
  'reparar-vehiculo': 'Instalar relé',
  'localizar-fuente-parcial': 'Registrar señal',
  'investigar-baliza-coatepeque': 'Investigar baliza',
  'investigar-senal': 'Registrar señal',
};

export function interactionLabelForObjective(
  objective: MissionObjective,
): string {
  const specific = objectiveLabels[objective.id];
  if (specific) return specific;
  switch (objective.type) {
    case 'interact':
      return 'Interactuar';
    case 'deliver':
      return 'Entregar objeto';
    case 'repair':
      return 'Reparar vehículo';
    case 'refuel':
      return 'Recargar combustible';
    case 'choice':
      return 'Elegir opción';
    case 'collect':
      return 'Recoger objeto';
    default:
      return objective.label;
  }
}

export function objectiveRequiresManualInteraction(
  objective: MissionObjective,
): boolean {
  return ['interact', 'deliver', 'repair', 'refuel', 'choice'].includes(
    objective.type,
  );
}

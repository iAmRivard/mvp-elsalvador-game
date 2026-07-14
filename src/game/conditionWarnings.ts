export type ConditionWarningLevel = 'damaged' | 'critical' | 'broken';

export const conditionWarningCopy: Readonly<
  Record<ConditionWarningLevel, { title: string; message: string }>
> = {
  damaged: {
    title: 'Condición 25%',
    message: 'El vehículo presenta daños.',
  },
  critical: {
    title: 'Condición 10%',
    message: 'Daño crítico. Busca un punto de reparación.',
  },
  broken: {
    title: 'Condición 0%',
    message: 'Vehículo averiado.',
  },
};

export function conditionWarningForTransition(
  previousCondition: number,
  condition: number,
): ConditionWarningLevel | null {
  if (previousCondition > 0 && condition <= 0) return 'broken';
  if (previousCondition > 10 && condition <= 10) return 'critical';
  if (previousCondition > 25 && condition <= 25) return 'damaged';
  return null;
}

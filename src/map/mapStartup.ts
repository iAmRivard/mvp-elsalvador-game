export type MapLoadingStage = 'map' | 'roads' | 'routes' | 'ready';

const optionalResourceFragments = [
  '/map-assets/sprites/',
  '/models/',
  '/audio/',
  'sprite image',
  'sprite json',
] as const;

export function mapErrorDetails(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return 'MapLibre no pudo completar la carga del recurso principal.';
}

export function isFatalMapError(error: unknown): boolean {
  const details = mapErrorDetails(error).toLowerCase();
  return !optionalResourceFragments.some((fragment) =>
    details.includes(fragment),
  );
}

export const mapLoadingLabels: Readonly<Record<MapLoadingStage, string>> = {
  map: 'Preparando mapa…',
  roads: 'Preparando carreteras…',
  routes: 'Preparando rutas…',
  ready: 'Listo para conducir',
};

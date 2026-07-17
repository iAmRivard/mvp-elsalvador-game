export type MapLoadingStage = 'map' | 'roads' | 'routes' | 'ready';

export type MapRuntimeErrorSeverity = 'fatal' | 'degraded' | 'optional';

export type MapRuntimeResourceKind =
  | 'webgl'
  | 'style'
  | 'primary-source'
  | 'road-network'
  | 'auxiliary-layer'
  | 'sprite'
  | 'model'
  | 'audio'
  | 'decorative'
  | 'unknown';

export interface MapRuntimeErrorContext {
  startupComplete: boolean;
  resourceKind?: MapRuntimeResourceKind;
  resourceUrl?: string | null;
  sourceId?: string | null;
  primaryStyleUrl?: string;
  primaryArchiveUrl?: string;
  primarySourceId?: string;
  persistent?: boolean;
}

export interface MapRuntimeErrorClassification {
  severity: MapRuntimeErrorSeverity;
  resourceKind: MapRuntimeResourceKind;
  reason:
    | 'webgl-context-lost'
    | 'primary-style'
    | 'primary-map-source'
    | 'road-network'
    | 'auxiliary-layer'
    | 'optional-resource'
    | 'unknown-during-startup'
    | 'unknown-after-startup';
  details: string;
}

const optionalResourceFragments = [
  '/map-assets/sprites/',
  '/models/',
  '/audio/',
  'sprite image',
  'sprite json',
] as const;

const optionalResourceKinds = new Set<MapRuntimeResourceKind>([
  'sprite',
  'model',
  'audio',
  'decorative',
]);

export function mapErrorDetails(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return 'MapLibre no pudo completar la carga del recurso principal.';
}

export function mapErrorResourceUrl(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'url' in error &&
    typeof error.url === 'string' &&
    error.url.trim()
  ) {
    return error.url;
  }
  return null;
}

function referencesResource(
  value: string,
  configuredResource: string | undefined,
): boolean {
  if (!configuredResource) return false;
  const normalizedConfiguredResource = configuredResource.toLowerCase();
  return (
    value.includes(normalizedConfiguredResource) ||
    value.includes(normalizedConfiguredResource.replace(/^pmtiles:\/\//, ''))
  );
}

function result(
  severity: MapRuntimeErrorSeverity,
  resourceKind: MapRuntimeResourceKind,
  reason: MapRuntimeErrorClassification['reason'],
  details: string,
): MapRuntimeErrorClassification {
  return { severity, resourceKind, reason, details };
}

export function classifyMapRuntimeError(
  error: unknown,
  context: MapRuntimeErrorContext,
): MapRuntimeErrorClassification {
  const details = mapErrorDetails(error);
  const detailsLowerCase = details.toLowerCase();
  const resourceUrl = (
    context.resourceUrl ??
    mapErrorResourceUrl(error) ??
    ''
  ).toLowerCase();
  const searchableDetails = `${detailsLowerCase} ${resourceUrl}`;
  const resourceKind = context.resourceKind ?? 'unknown';

  if (
    resourceKind === 'webgl' ||
    detailsLowerCase.includes('webgl context lost')
  ) {
    return result('fatal', 'webgl', 'webgl-context-lost', details);
  }

  if (
    resourceKind === 'style' ||
    referencesResource(searchableDetails, context.primaryStyleUrl)
  ) {
    return result('fatal', 'style', 'primary-style', details);
  }

  const referencesPrimaryArchive = referencesResource(
    searchableDetails,
    context.primaryArchiveUrl,
  );
  const referencesPrimarySource =
    Boolean(context.primarySourceId) &&
    context.sourceId === context.primarySourceId;
  if (
    resourceKind === 'primary-source' ||
    referencesPrimaryArchive ||
    (referencesPrimarySource && context.persistent === true)
  ) {
    return result(
      'fatal',
      'primary-source',
      'primary-map-source',
      details,
    );
  }

  if (resourceKind === 'road-network') {
    return result('degraded', resourceKind, 'road-network', details);
  }

  if (resourceKind === 'auxiliary-layer') {
    return result('degraded', resourceKind, 'auxiliary-layer', details);
  }

  if (
    optionalResourceKinds.has(resourceKind) ||
    optionalResourceFragments.some((fragment) =>
      searchableDetails.includes(fragment),
    )
  ) {
    return result(
      'optional',
      resourceKind === 'unknown' ? 'decorative' : resourceKind,
      'optional-resource',
      details,
    );
  }

  if (context.startupComplete) {
    return result(
      'degraded',
      'unknown',
      'unknown-after-startup',
      details,
    );
  }

  return result('fatal', 'unknown', 'unknown-during-startup', details);
}

export function mapRuntimeErrorStopsGameplay(
  classification: MapRuntimeErrorClassification,
): boolean {
  return classification.severity === 'fatal';
}

export const mapLoadingLabels: Readonly<Record<MapLoadingStage, string>> = {
  map: 'Preparando mapa…',
  roads: 'Preparando carreteras…',
  routes: 'Preparando rutas…',
  ready: 'Listo para conducir',
};

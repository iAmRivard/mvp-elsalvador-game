export const contextualAdviceIds = [
  'interaction',
  'objective',
  'journal',
  'boost',
] as const;

export type ContextualAdviceId = (typeof contextualAdviceIds)[number];

export interface ContextualAdviceContext {
  interactionLabel: string | null;
  objectiveRelevant: boolean;
  journalHasNewContent: boolean;
  boostIsSafe: boolean;
}

export interface ContextualAdvice {
  id: ContextualAdviceId;
  title: string;
  message: string;
  actionLabel?: string;
}

export function selectContextualAdvice(
  context: ContextualAdviceContext,
  seen: ReadonlySet<ContextualAdviceId>,
): ContextualAdvice | null {
  if (context.interactionLabel && !seen.has('interaction')) {
    return {
      id: 'interaction',
      title: context.interactionLabel,
      message: 'La acción está disponible en el control.',
    };
  }
  if (context.objectiveRelevant && !seen.has('objective')) {
    return {
      id: 'objective',
      title: 'Objetivo a la vista',
      message: 'El círculo brillante marca tu próxima acción.',
    };
  }
  if (context.boostIsSafe && !seen.has('boost')) {
    return {
      id: 'boost',
      title: 'Turbo disponible',
      message: 'Úsalo ahora que tienes marcha y espacio libre.',
    };
  }
  if (context.journalHasNewContent && !seen.has('journal')) {
    return {
      id: 'journal',
      title: 'Nueva señal registrada',
      message: 'Puedes revisarla sin detener la misión.',
      actionLabel: 'Abrir bitácora',
    };
  }
  return null;
}

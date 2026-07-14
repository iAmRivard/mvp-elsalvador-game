export interface ProgressCounter {
  completed: number;
  total: number;
}

export function progressCounter(
  availableIds: readonly string[],
  completedIds: readonly string[],
): ProgressCounter {
  const completed = new Set(completedIds);
  return {
    completed: availableIds.filter((id) => completed.has(id)).length,
    total: availableIds.length,
  };
}

export const INITIAL_ENERGY = 100;
export const INITIAL_MAX_ENERGY = 100;
export const EXPERIENCE_STEP = 250;

export interface ExperienceProgress {
  level: number;
  experienceIntoLevel: number;
  experienceForNextLevel: number;
  ratio: number;
}

export function experienceRequiredForLevel(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level));
  return (EXPERIENCE_STEP * normalizedLevel * (normalizedLevel - 1)) / 2;
}

export function levelForExperience(experience: number): number {
  const normalizedExperience = Math.max(0, Math.floor(experience));
  let level = 1;
  while (
    level < 100 &&
    normalizedExperience >= experienceRequiredForLevel(level + 1)
  ) {
    level += 1;
  }
  return level;
}

export function experienceProgress(experience: number): ExperienceProgress {
  const normalizedExperience = Math.max(0, Math.floor(experience));
  const level = levelForExperience(normalizedExperience);
  const levelStart = experienceRequiredForLevel(level);
  const nextLevel = experienceRequiredForLevel(level + 1);
  const experienceForNextLevel = nextLevel - levelStart;
  const experienceIntoLevel = normalizedExperience - levelStart;

  return {
    level,
    experienceIntoLevel,
    experienceForNextLevel,
    ratio: Math.min(1, experienceIntoLevel / experienceForNextLevel),
  };
}

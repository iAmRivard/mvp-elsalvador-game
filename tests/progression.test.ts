import { describe, expect, it } from 'vitest';
import {
  experienceProgress,
  experienceRequiredForLevel,
  levelForExperience,
} from '../src/game/progression';

describe('progresión del jugador', () => {
  it('calcula umbrales crecientes de experiencia', () => {
    expect(experienceRequiredForLevel(1)).toBe(0);
    expect(experienceRequiredForLevel(2)).toBe(250);
    expect(experienceRequiredForLevel(3)).toBe(750);
    expect(experienceRequiredForLevel(4)).toBe(1_500);
  });

  it('sube de nivel al alcanzar cada umbral', () => {
    expect(levelForExperience(0)).toBe(1);
    expect(levelForExperience(249)).toBe(1);
    expect(levelForExperience(250)).toBe(2);
    expect(levelForExperience(950)).toBe(3);
  });

  it('expone el progreso relativo al siguiente nivel', () => {
    expect(experienceProgress(500)).toEqual({
      level: 2,
      experienceIntoLevel: 250,
      experienceForNextLevel: 500,
      ratio: 0.5,
    });
  });
});

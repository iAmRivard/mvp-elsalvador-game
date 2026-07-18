import { describe, expect, it } from 'vitest';
import {
  advanceRoadAssistActiveElapsedMilliseconds,
  lateRoadPromotionAssistRampMilliseconds,
  roadAssistMultiplierForLatePromotion,
} from '../src/game/roadPromotion';

describe('promoción tardía de red vial', () => {
  it('incorpora la asistencia gradualmente sin alterar una carga normal', () => {
    expect(roadAssistMultiplierForLatePromotion(null, 500)).toBe(1);
    expect(roadAssistMultiplierForLatePromotion(500, 400)).toBe(0);
    expect(roadAssistMultiplierForLatePromotion(500, 500)).toBe(0);
    expect(
      roadAssistMultiplierForLatePromotion(
        500,
        500 + lateRoadPromotionAssistRampMilliseconds / 2,
      ),
    ).toBe(0.5);
    expect(
      roadAssistMultiplierForLatePromotion(
        500,
        500 + lateRoadPromotionAssistRampMilliseconds,
      ),
    ).toBe(1);
    expect(roadAssistMultiplierForLatePromotion(500, Number.NaN)).toBe(0);
  });

  it('cuenta solo ticks activos y limita el primer frame tras una pausa', () => {
    expect(
      advanceRoadAssistActiveElapsedMilliseconds(0, null, 10_000, 250),
    ).toBe(0);
    expect(
      advanceRoadAssistActiveElapsedMilliseconds(0, 10_000, 10_100, 250),
    ).toBe(100);
    expect(
      advanceRoadAssistActiveElapsedMilliseconds(100, null, 30_000, 250),
    ).toBe(100);
    expect(
      advanceRoadAssistActiveElapsedMilliseconds(100, 10_100, 30_000, 250),
    ).toBe(350);
  });
});

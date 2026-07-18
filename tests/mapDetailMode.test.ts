import { describe, expect, it } from 'vitest';
import { deriveMapDetailMode } from '../src/game/mapDetailMode';

describe('modo explícito de detalle del mapa', () => {
  it('mantiene detalle arcade al detenerse durante una misión', () => {
    expect(
      deriveMapDetailMode({
        isFollowingPlayer: true,
        presentationMode: 'stopped',
        activeMissionId: 'la-transmision',
      }),
    ).toBe('arcade-driving');
  });

  it('usa detalle rápido solo al conducir rápido', () => {
    expect(
      deriveMapDetailMode({
        isFollowingPlayer: true,
        presentationMode: 'fast',
        activeMissionId: 'la-transmision',
      }),
    ).toBe('arcade-fast');
    expect(
      deriveMapDetailMode({
        isFollowingPlayer: true,
        presentationMode: 'alert',
        activeMissionId: 'la-transmision',
      }),
    ).toBe('arcade-driving');
  });

  it('restaura exploración solo al abandonar el seguimiento', () => {
    expect(
      deriveMapDetailMode({
        isFollowingPlayer: false,
        presentationMode: 'stopped',
        activeMissionId: 'la-transmision',
      }),
    ).toBe('exploration');
    expect(
      deriveMapDetailMode({
        isFollowingPlayer: true,
        presentationMode: 'stopped',
        activeMissionId: null,
        isMapSelectionMode: true,
      }),
    ).toBe('exploration');
  });
});

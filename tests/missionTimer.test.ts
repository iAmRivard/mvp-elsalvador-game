import { describe, expect, it } from 'vitest';
import {
  formatMissionTimer,
  missionTimerUrgency,
} from '../src/game/missionTimer';

describe('temporizador de misión', () => {
  it('formatea el tiempo restante como mm:ss', () => {
    expect(formatMissionTimer(270)).toBe('04:30');
    expect(formatMissionTimer(60)).toBe('01:00');
    expect(formatMissionTimer(9.1)).toBe('00:10');
    expect(formatMissionTimer(-2)).toBe('00:00');
  });

  it('cambia de estado en los umbrales visibles', () => {
    expect(missionTimerUrgency(61)).toBe('normal');
    expect(missionTimerUrgency(60)).toBe('warning');
    expect(missionTimerUrgency(30)).toBe('urgent');
    expect(missionTimerUrgency(10)).toBe('critical');
  });
});

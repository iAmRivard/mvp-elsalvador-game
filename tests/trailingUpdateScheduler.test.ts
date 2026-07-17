import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrailingUpdateScheduler } from '../src/map/trailingUpdateScheduler';

describe('actualizacion final de navegacion', () => {
  afterEach(() => vi.useRealTimers());

  it('aplica la ultima muestra aunque llegue dentro del intervalo', () => {
    vi.useFakeTimers();
    const applied: number[] = [];
    const scheduler = createTrailingUpdateScheduler(200, (value: number) => {
      applied.push(value);
    });

    scheduler.schedule(1);
    vi.advanceTimersByTime(50);
    scheduler.schedule(2);
    expect(applied).toEqual([1]);

    vi.advanceTimersByTime(150);
    expect(applied).toEqual([1, 2]);
  });

  it('agrupa muestras rapidas y conserva solamente la mas reciente', () => {
    vi.useFakeTimers();
    const applied: number[] = [];
    const scheduler = createTrailingUpdateScheduler(200, (value: number) => {
      applied.push(value);
    });

    scheduler.schedule(1);
    vi.advanceTimersByTime(40);
    scheduler.schedule(2);
    vi.advanceTimersByTime(40);
    scheduler.schedule(3);
    vi.advanceTimersByTime(120);

    expect(applied).toEqual([1, 3]);
  });

  it('cancela una muestra pendiente al desmontar la ruta', () => {
    vi.useFakeTimers();
    const applied: number[] = [];
    const scheduler = createTrailingUpdateScheduler(200, (value: number) => {
      applied.push(value);
    });

    scheduler.schedule(1);
    vi.advanceTimersByTime(50);
    scheduler.schedule(2);
    scheduler.cancel();
    vi.advanceTimersByTime(200);

    expect(applied).toEqual([1]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  AdaptiveCameraCadenceController,
  adaptiveCameraCadenceFor,
  cameraCadenceDeadlineAfterApplication,
  cameraCadenceIntervalMilliseconds,
  cameraCadenceShouldApply,
  initialAdaptiveCameraCadence,
  type AdaptiveCameraCadenceState,
  type CameraPerformanceWindow,
} from '../src/game/adaptiveCameraCadence';

const healthyWindow: CameraPerformanceWindow = {
  durationMilliseconds: 5_000,
  frameCount: 300,
  frametimeP95Milliseconds: 16,
  framesOver50Milliseconds: 0,
  framesOver100Milliseconds: 0,
  cameraP95Milliseconds: 2,
};

describe('cadencia adaptativa de cámara', () => {
  it('sube de inmediato a 30 Hz cuando la conducción lo exige', () => {
    const controller = new AdaptiveCameraCadenceController({
      initialHertz: 20,
      maximumHertz: 30,
    });

    expect(controller.ensureMinimumHertz(30)).toBe(true);
    expect(controller.state.hertz).toBe(30);
    expect(controller.ensureMinimumHertz(30)).toBe(false);
  });

  it('permite bajar a 20 Hz tras dos ventanas malas y no revierte la protección', () => {
    const controller = new AdaptiveCameraCadenceController({
      initialHertz: 30,
      maximumHertz: 30,
      windowDurationMilliseconds: 4_000,
    });
    controller.recordVisualFrame(0);
    controller.recordCameraUpdate(4);
    controller.recordVisualFrame(50);
    controller.recordVisualFrame(4_000);
    controller.recordCameraUpdate(4);
    controller.recordVisualFrame(4_050);
    controller.recordVisualFrame(8_000);

    expect(controller.state.hertz).toBe(20);
    expect(controller.ensureMinimumHertz(30)).toBe(false);
    expect(controller.state.hertz).toBe(20);
  });

  it('conserva el residuo temporal para aproximar 45 aplicaciones por segundo sobre RAF de 60 Hz', () => {
    const interval = cameraCadenceIntervalMilliseconds(45);
    let deadline = 0;
    let applications = 0;
    for (let timestamp = 0; timestamp < 10_000; timestamp += 1_000 / 60) {
      if (!cameraCadenceShouldApply(timestamp, deadline)) continue;
      applications += 1;
      deadline = cameraCadenceDeadlineAfterApplication(
        deadline,
        timestamp,
        interval,
      );
    }
    expect(applications).toBeGreaterThanOrEqual(448);
    expect(applications).toBeLessThanOrEqual(452);
  });

  it('cuenta una pausa visible mayor de un segundo como frame severo', () => {
    const controller = new AdaptiveCameraCadenceController({
      initialHertz: 45,
      maximumHertz: 60,
      windowDurationMilliseconds: 4_000,
    });
    controller.recordVisualFrame(0);
    controller.recordCameraUpdate(2);
    controller.recordVisualFrame(16);
    controller.recordVisualFrame(1_017);
    for (let timestamp = 1_033; timestamp <= 4_050; timestamp += 16) {
      controller.recordCameraUpdate(2);
      controller.recordVisualFrame(timestamp);
    }
    expect(controller.lastCompletedWindow?.framesOver50Milliseconds).toBe(1);
    expect(controller.lastCompletedWindow?.framesOver100Milliseconds).toBe(1);
    expect(controller.state.consecutiveUnhealthyWindows).toBe(1);
  });

  it('reinicia la ventana y la histéresis al volver desde background', () => {
    const controller = new AdaptiveCameraCadenceController({
      initialHertz: 30,
      maximumHertz: 60,
      windowDurationMilliseconds: 4_000,
    });
    let timestamp = 0;
    const recordHealthyWindow = () => {
      const end = timestamp + 4_050;
      while (timestamp <= end) {
        controller.recordCameraUpdate(2);
        controller.recordVisualFrame(timestamp);
        timestamp += 16;
      }
    };
    recordHealthyWindow();
    expect(controller.state.consecutiveHealthyWindows).toBe(1);
    controller.resetSampling(timestamp);
    expect(controller.state.consecutiveHealthyWindows).toBe(0);
    recordHealthyWindow();
    recordHealthyWindow();
    expect(controller.state.hertz).toBe(30);
    recordHealthyWindow();
    expect(controller.state.hertz).toBe(45);
  });

  it('integra muestras sostenidas y aplica el intervalo de la cadencia elegida', () => {
    const controller = new AdaptiveCameraCadenceController({
      initialHertz: 30,
      maximumHertz: 60,
      windowDurationMilliseconds: 4_000,
    });
    let timestamp = 0;
    for (let window = 0; window < 3; window += 1) {
      const windowEnd = timestamp + 4_050;
      while (timestamp <= windowEnd) {
        controller.recordCameraUpdate(2);
        controller.recordVisualFrame(timestamp);
        timestamp += 16;
      }
    }

    expect(controller.state.hertz).toBe(45);
    expect(controller.intervalMilliseconds).toBeCloseTo(1_000 / 45);
    expect(cameraCadenceIntervalMilliseconds(60)).toBeCloseTo(1_000 / 60);
  });

  it('mantiene 30 Hz con el perfil del baseline y degrada solo tras dos ventanas malas', () => {
    const baseline = new AdaptiveCameraCadenceController({
      initialHertz: 30,
      maximumHertz: 60,
      windowDurationMilliseconds: 4_000,
    });
    let timestamp = 0;
    for (let window = 0; window < 6; window += 1) {
      const windowEnd = timestamp + 4_050;
      while (timestamp <= windowEnd) {
        baseline.recordCameraUpdate(2.8);
        baseline.recordVisualFrame(timestamp);
        timestamp += 33.3;
      }
    }
    expect(baseline.state.hertz).toBe(30);

    const degraded = new AdaptiveCameraCadenceController({
      initialHertz: 45,
      maximumHertz: 60,
      windowDurationMilliseconds: 4_000,
    });
    timestamp = 0;
    for (let window = 0; window < 2; window += 1) {
      const windowEnd = timestamp + 4_050;
      while (timestamp <= windowEnd) {
        degraded.recordCameraUpdate(3.2);
        degraded.recordVisualFrame(timestamp);
        timestamp += 60;
      }
    }
    expect(degraded.state.hertz).toBe(30);
  });

  it('no promociona por una sola ventana buena', () => {
    expect(
      adaptiveCameraCadenceFor(initialAdaptiveCameraCadence, healthyWindow),
    ).toMatchObject({ hertz: 30, consecutiveHealthyWindows: 1 });
  });

  it('promociona con varias ventanas estables', () => {
    let state = initialAdaptiveCameraCadence;
    for (let index = 0; index < 3; index += 1) {
      state = adaptiveCameraCadenceFor(state, healthyWindow);
    }
    expect(state.hertz).toBe(45);
  });

  it('un solo frame malo no degrada la frecuencia', () => {
    const state = adaptiveCameraCadenceFor(
      { ...initialAdaptiveCameraCadence, hertz: 45 },
      { ...healthyWindow, framesOver50Milliseconds: 1 },
    );
    expect(state.hertz).toBe(45);
    expect(state.consecutiveUnhealthyWindows).toBe(1);
  });

  it('degrada tras ventanas malas sostenidas y nunca promociona con cámara p95 sin margen', () => {
    const badWindow = {
      ...healthyWindow,
      frametimeP95Milliseconds: 34,
      framesOver50Milliseconds: 8,
      cameraP95Milliseconds: 3.1,
    };
    let state: AdaptiveCameraCadenceState = {
      ...initialAdaptiveCameraCadence,
      hertz: 45,
    };
    state = adaptiveCameraCadenceFor(state, badWindow);
    state = adaptiveCameraCadenceFor(state, badWindow);
    expect(state.hertz).toBe(30);

    let baselineState = initialAdaptiveCameraCadence;
    const currentBaseline = {
      ...healthyWindow,
      frametimeP95Milliseconds: 33.3,
      cameraP95Milliseconds: 2.8,
    };
    for (let index = 0; index < 6; index += 1) {
      baselineState = adaptiveCameraCadenceFor(baselineState, currentBaseline);
    }
    expect(baselineState.hertz).toBe(30);
  });
});

import { describe, expect, it } from 'vitest';
import {
  arcadeCaptureScenarioFor,
  arcadeCaptureScenarios,
} from '../scripts/performance/arcade-capture-scenarios.mjs';

describe('contratos de captura arcade', () => {
  it('mantiene crucero como escenario predeterminado y comparable', () => {
    const scenario = arcadeCaptureScenarioFor(undefined);

    expect(scenario).toBe(arcadeCaptureScenarios.cruise);
    expect(scenario.id).toBe('arcade-core-trunk-cruise-v3');
    expect(scenario.expectedCameraProfile).toBe('mobileDriving');
    expect(scenario.averageSpeedKilometersPerHour).toEqual({
      minimum: 52,
      maximum: 70,
    });
  });

  it('define alta velocidad sostenida por encima del umbral mobileFast', () => {
    const scenario = arcadeCaptureScenarioFor('fast');

    expect(scenario).toBe(arcadeCaptureScenarios.fast);
    expect(scenario.id).toBe('arcade-core-trunk-fast-v1');
    expect(scenario.expectedCameraProfile).toBe('mobileFast');
    expect(scenario.releaseThresholdKilometersPerHour).toBeGreaterThanOrEqual(
      85,
    );
    expect(scenario.averageSpeedKilometersPerHour.minimum).toBeGreaterThan(84);
    expect(scenario.averageSpeedKilometersPerHour.maximum).toBeLessThanOrEqual(
      96,
    );
  });

  it('rechaza nombres de escenario desconocidos', () => {
    expect(() => arcadeCaptureScenarioFor('desconocido')).toThrow(
      'ARCADE_CAPTURE_SCENARIO',
    );
  });
});

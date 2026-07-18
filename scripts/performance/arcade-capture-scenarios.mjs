const cruiseScenario = Object.freeze({
  id: 'arcade-core-trunk-cruise-v3',
  verticalTravelJoystickRatio: 0.28,
  holdMilliseconds: 2_200,
  releaseThresholdKilometersPerHour: 58,
  expectedCameraProfile: 'mobileDriving',
  averageSpeedKilometersPerHour: Object.freeze({
    minimum: 52,
    maximum: 70,
  }),
  distanceMeters: Object.freeze({ minimum: 2_400, maximum: 3_200 }),
});

const fastScenario = Object.freeze({
  id: 'arcade-core-trunk-fast-v1',
  verticalTravelJoystickRatio: 0.5,
  holdMilliseconds: 2_200,
  releaseThresholdKilometersPerHour: 85,
  expectedCameraProfile: 'mobileFast',
  averageSpeedKilometersPerHour: Object.freeze({
    minimum: 85,
    maximum: 96,
  }),
  distanceMeters: Object.freeze({ minimum: 3_300, maximum: 4_500 }),
});

export const arcadeCaptureScenarios = Object.freeze({
  cruise: cruiseScenario,
  fast: fastScenario,
});

export function arcadeCaptureScenarioFor(value) {
  const name = value == null || value === '' ? 'cruise' : value;
  const scenario = arcadeCaptureScenarios[name];
  if (!scenario) {
    throw new Error(
      `ARCADE_CAPTURE_SCENARIO debe ser "cruise" o "fast"; recibido: ${String(value)}.`,
    );
  }
  return scenario;
}

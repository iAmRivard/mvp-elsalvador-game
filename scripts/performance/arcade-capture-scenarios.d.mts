export interface ArcadeCaptureScenario {
  readonly id: string;
  readonly verticalTravelJoystickRatio: number;
  readonly holdMilliseconds: number;
  readonly releaseThresholdKilometersPerHour: number;
  readonly expectedCameraProfile: 'mobileDriving' | 'mobileFast';
  readonly averageSpeedKilometersPerHour: Readonly<{
    minimum: number;
    maximum: number;
  }>;
  readonly distanceMeters: Readonly<{
    minimum: number;
    maximum: number;
  }>;
}

export const arcadeCaptureScenarios: Readonly<{
  cruise: ArcadeCaptureScenario;
  fast: ArcadeCaptureScenario;
}>;

export function arcadeCaptureScenarioFor(
  value: string | undefined,
): ArcadeCaptureScenario;

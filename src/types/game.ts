export interface PlayerRuntime {
  longitude: number;
  latitude: number;
  heading: number;
  speedMetersPerSecond: number;
  fuel: number;
  totalDistanceMeters: number;
}

export interface PlayerInput {
  throttle: -1 | 0 | 1;
  turn: -1 | 0 | 1;
  boost: boolean;
  interact: boolean;
}

export interface PlayerTelemetry extends PlayerRuntime {
  speedKilometersPerHour: number;
}

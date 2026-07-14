export interface PlayerRuntime {
  longitude: number;
  latitude: number;
  heading: number;
  speedMetersPerSecond: number;
  fuel: number;
  totalDistanceMeters: number;
}

export interface PlayerInput {
  throttle: number;
  turn: number;
  boost: boolean;
  interact: boolean;
}

export interface PlayerTelemetry extends PlayerRuntime {
  speedKilometersPerHour: number;
}

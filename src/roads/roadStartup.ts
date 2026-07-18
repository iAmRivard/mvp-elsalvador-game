export const ROAD_NETWORK_STARTUP_DEADLINE_MILLISECONDS = 8_000;

let roadlessStartupAllowed = false;

export function beginRoadNetworkStartupAttempt(): void {
  roadlessStartupAllowed = false;
}

export function allowRoadlessStartup(): void {
  roadlessStartupAllowed = true;
}

export function isRoadlessStartupAllowed(): boolean {
  return roadlessStartupAllowed;
}

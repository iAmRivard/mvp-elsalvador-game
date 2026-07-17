export type RuntimeBlockReason =
  | 'startup'
  | 'fatal-map'
  | 'pause'
  | 'journal'
  | 'narrative'
  | 'mission-choice'
  | 'recovery'
  | 'vehicle-disabled'
  | null;

export interface RuntimeGateInput {
  startupReady: boolean;
  fatalMapError: boolean;
  paused: boolean;
  journalOpen: boolean;
  narrativeActive: boolean;
  missionChoiceActive: boolean;
  recoveryActive: boolean;
  vehicleEnabled: boolean;
}

export interface RuntimeGate {
  simulationEnabled: boolean;
  drivingInputEnabled: boolean;
  missionClockEnabled: boolean;
  blockedBy: RuntimeBlockReason;
}

export function runtimeGateFor(input: RuntimeGateInput): RuntimeGate {
  const blockedBy: RuntimeBlockReason = !input.startupReady
    ? 'startup'
    : input.fatalMapError
      ? 'fatal-map'
      : input.paused
        ? 'pause'
        : input.journalOpen
          ? 'journal'
          : input.narrativeActive
            ? 'narrative'
            : input.missionChoiceActive
              ? 'mission-choice'
              : input.recoveryActive
                ? 'recovery'
                : !input.vehicleEnabled
                  ? 'vehicle-disabled'
                  : null;
  return {
    simulationEnabled: blockedBy === null,
    drivingInputEnabled: blockedBy === null,
    missionClockEnabled: blockedBy === null || blockedBy === 'journal',
    blockedBy,
  };
}

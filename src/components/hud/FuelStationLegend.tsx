import { useEffect, useState } from 'react';
import { fuelStationById } from '../../data/fuelStations';
import {
  fuelStationPresentation,
  requiredFuelStationForMission,
  type FuelStationPresentation,
} from '../../game/fuelStations';
import { useGameStore } from '../../store/gameStore';

interface FuelLegendSnapshot {
  mode: FuelStationPresentation;
  label: string;
}

function readSnapshot(): FuelLegendSnapshot {
  const state = useGameStore.getState();
  const selected =
    state.navigationTarget?.kind === 'fuel-station'
      ? fuelStationById.get(state.navigationTarget.id)
      : null;
  const required = requiredFuelStationForMission(
    state.activeMissionId,
    state.activeMissionCompletedObjectiveIds,
  );
  const mode = fuelStationPresentation({
    fuelPercent: state.telemetry.fuel,
    hasActiveMission: state.activeMissionId !== null,
    selected: Boolean(selected),
    requiredByMission: Boolean(required),
  });
  return {
    mode,
    label:
      selected?.name ??
      required?.name ??
      (mode === 'full' ? 'Combustible bajo' : 'Combustible'),
  };
}

export function FuelStationLegend() {
  const [snapshot, setSnapshot] = useState(readSnapshot);

  useEffect(
    () =>
      useGameStore.subscribe(() => {
        const next = readSnapshot();
        setSnapshot((current) =>
          current.mode === next.mode && current.label === next.label
            ? current
            : next,
        );
      }),
    [],
  );

  return (
    <div
      className={`map-fuel-legend map-fuel-legend--${snapshot.mode}`}
      aria-label={snapshot.label}
      data-fuel-presentation={snapshot.mode}
    >
      <span aria-hidden="true">⛽</span>
      {snapshot.mode !== 'icon' && <strong>{snapshot.label}</strong>}
    </div>
  );
}

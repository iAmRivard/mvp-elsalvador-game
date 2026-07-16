import { fuelStationConfig } from '../../config/fuelStations.config';
import { fuelStationById } from '../../data/fuelStations';
import {
  fuelAlertLevel,
  isFuelStationAvailable,
  isWithinFuelStationRange,
  nearestAvailableFuelStation,
  requiredFuelStationForMission,
} from '../../game/fuelStations';
import { inventoryQuantity } from '../../game/inventory';
import { useGameStore } from '../../store/gameStore';

function formatDistance(distanceMeters: number): string {
  return distanceMeters < 1_000
    ? `${Math.round(distanceMeters)} m`
    : `${(distanceMeters / 1_000).toFixed(1)} km`;
}

export function FuelAssist() {
  const telemetry = useGameStore((state) => state.telemetry);
  const vehicle = useGameStore((state) => state.vehicle);
  const currentChapterId = useGameStore((state) => state.currentChapterId);
  const navigationTarget = useGameStore((state) => state.navigationTarget);
  const activeMissionId = useGameStore((state) => state.activeMissionId);
  const completedObjectiveIds = useGameStore(
    (state) => state.activeMissionCompletedObjectiveIds,
  );
  const canisterCount = useGameStore((state) =>
    inventoryQuantity(state.inventory, 'bidon-combustible'),
  );
  const markFuelStationRoute = useGameStore(
    (state) => state.markFuelStationRoute,
  );
  const clearNavigationTarget = useGameStore(
    (state) => state.clearNavigationTarget,
  );
  const refuelAtStation = useGameStore((state) => state.refuelAtStation);
  const useFuelCanister = useGameStore((state) => state.useFuelCanister);

  const playerCoordinates = [telemetry.longitude, telemetry.latitude] as const;
  const nearest = nearestAvailableFuelStation(
    playerCoordinates,
    currentChapterId,
  );
  const selectedStation =
    navigationTarget?.kind === 'fuel-station'
      ? fuelStationById.get(navigationTarget.id)
      : null;
  const selected =
    selectedStation && isFuelStationAvailable(selectedStation, currentChapterId)
      ? {
          station: selectedStation,
          distanceMeters:
            nearestAvailableFuelStation(playerCoordinates, currentChapterId, [
              selectedStation,
            ])?.distanceMeters ?? Number.POSITIVE_INFINITY,
        }
      : null;
  const requiredStation = requiredFuelStationForMission(
    activeMissionId,
    completedObjectiveIds,
  );
  const required =
    requiredStation &&
    isFuelStationAvailable(requiredStation, currentChapterId)
      ? {
          station: requiredStation,
          distanceMeters:
            nearestAvailableFuelStation(playerCoordinates, currentChapterId, [
              requiredStation,
            ])?.distanceMeters ?? Number.POSITIVE_INFINITY,
        }
      : null;
  const destination = selected ?? required ?? nearest;
  const hasFuelRoute = navigationTarget?.kind === 'fuel-station';
  const selectedNearby =
    selected && isWithinFuelStationRange(selected.distanceMeters)
      ? selected
      : null;
  const nearby =
    selectedNearby ??
    (!selected && nearest && isWithinFuelStationRange(nearest.distanceMeters)
      ? nearest
      : null);
  const alertLevel = fuelAlertLevel(telemetry.fuel);
  const canRefuel =
    telemetry.speedKilometersPerHour <=
    fuelStationConfig.maximumRefuelSpeedKilometersPerHour;

  if (!alertLevel && !hasFuelRoute && !required) return null;

  if (nearby && telemetry.fuel < vehicle.maximumFuel) {
    if (alertLevel === 'critical' || hasFuelRoute || required) {
      return (
        <aside
          className="fuel-assist fuel-assist--station"
          aria-label="Punto de combustible"
          data-testid="fuel-assist"
        >
          <span className="fuel-assist__eyebrow">Punto de combustible</span>
          <strong>{nearby.station.name}</strong>
          <div className="fuel-assist__stats">
            <span>Combustible actual: {telemetry.fuel.toFixed(0)}%</span>
            <span>Costo: gratuito</span>
          </div>
          <button
            type="button"
            className="fuel-assist__primary"
            disabled={!canRefuel}
            onClick={() => refuelAtStation(nearby.station.id)}
          >
            {canRefuel
              ? 'Recargar combustible'
              : 'Detente para recargar combustible'}
          </button>
        </aside>
      );
    }

    return (
      <aside
        className="fuel-assist fuel-assist--station fuel-assist--station-compact"
        aria-label="Punto de combustible"
        data-testid="fuel-assist"
      >
        <button
          type="button"
          className="fuel-assist__compact"
          title={nearby.station.name}
          disabled={!canRefuel}
          onClick={() => refuelAtStation(nearby.station.id)}
        >
          <span aria-hidden="true">⛽</span>
          <strong>
            {canRefuel
              ? 'Recargar combustible'
              : 'Detente para recargar combustible'}
          </strong>
          <small>· {nearby.station.name}</small>
        </button>
      </aside>
    );
  }

  if (hasFuelRoute && !selected) return null;
  if (!destination) return null;

  if (hasFuelRoute && selected) {
    return (
      <aside
        className="fuel-assist fuel-assist--route"
        aria-label="Ruta temporal a combustible"
        data-testid="fuel-assist"
      >
        <span className="fuel-assist__eyebrow">
          ⛽ Punto de combustible · {formatDistance(selected.distanceMeters)}
        </span>
        <strong>{selected.station.name}</strong>
        <div className="fuel-assist__actions">
          <button type="button" onClick={clearNavigationTarget}>
            {activeMissionId ? 'Volver a misión' : 'Cancelar ruta'}
          </button>
        </div>
      </aside>
    );
  }

  if (required) {
    return (
      <aside
        className="fuel-assist fuel-assist--mission"
        aria-label="Combustible requerido por la misión"
        data-testid="fuel-assist"
      >
        <span className="fuel-assist__eyebrow">Objetivo de misión</span>
        <strong>{required.station.name}</strong>
        <small>{formatDistance(required.distanceMeters)}</small>
      </aside>
    );
  }

  if (alertLevel === 'low') {
    return (
      <aside
        className="fuel-assist fuel-assist--nearby"
        aria-label="Estación de combustible cercana"
        data-testid="fuel-assist"
      >
        <button
          type="button"
          className="fuel-assist__compact"
          title={destination.station.name}
          onClick={() => markFuelStationRoute(destination.station.id)}
        >
          <span aria-hidden="true">⛽</span>
          <strong>Estación cercana</strong>
          <small>· {formatDistance(destination.distanceMeters)}</small>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="fuel-assist fuel-assist--critical"
      aria-label="Combustible bajo"
      data-testid="fuel-assist"
    >
      <span className="fuel-assist__eyebrow">Combustible bajo</span>
      <strong>{destination.station.name}</strong>
      <small>
        Estación más cercana: {formatDistance(destination.distanceMeters)}
      </small>
      <div className="fuel-assist__actions">
        <button
          type="button"
          className="fuel-assist__primary"
          onClick={() => markFuelStationRoute(destination.station.id)}
        >
          Marcar ruta
        </button>
        <button
          type="button"
          disabled={canisterCount === 0}
          onClick={useFuelCanister}
        >
          Usar bidón{canisterCount > 0 ? ` (${String(canisterCount)})` : ''}
        </button>
      </div>
    </aside>
  );
}

import { fuelStationConfig } from '../../config/fuelStations.config';
import { fuelStationById } from '../../data/fuelStations';
import { estimateFuelRange } from '../../game/fuel';
import {
  fuelAlertLevel,
  isFuelStationAvailable,
  isWithinFuelStationRange,
  nearestAvailableFuelStation,
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
  const drivingSurface = useGameStore((state) => state.driving.surface);
  const currentChapterId = useGameStore((state) => state.currentChapterId);
  const navigationTarget = useGameStore((state) => state.navigationTarget);
  const activeMissionId = useGameStore((state) => state.activeMissionId);
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
  const destination = selected ?? nearest;
  const nearby =
    nearest && isWithinFuelStationRange(nearest.distanceMeters)
      ? nearest
      : null;
  const alertLevel = fuelAlertLevel(telemetry.fuel);
  const hasFuelRoute = navigationTarget?.kind === 'fuel-station';
  const canRefuel =
    telemetry.speedKilometersPerHour <=
    fuelStationConfig.maximumRefuelSpeedKilometersPerHour;

  if (
    (!nearby || telemetry.fuel >= vehicle.maximumFuel) &&
    !alertLevel &&
    !hasFuelRoute
  ) {
    return null;
  }

  if (nearby && telemetry.fuel < vehicle.maximumFuel) {
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
          {canRefuel ? 'Recargar' : 'Detente para recargar'}
        </button>
      </aside>
    );
  }

  if (!destination) return null;

  const rangeKilometers =
    estimateFuelRange(telemetry.fuel, drivingSurface) / 1_000;
  const title =
    alertLevel === 'critical'
      ? 'Combustible crítico'
      : alertLevel === 'low'
        ? 'Combustible bajo'
        : 'Ruta a combustible';

  return (
    <aside
      className={`fuel-assist ${alertLevel === 'critical' ? 'fuel-assist--critical' : ''}`}
      aria-label={title}
      data-testid="fuel-assist"
    >
      <span className="fuel-assist__eyebrow">{title}</span>
      <strong>{destination.station.name}</strong>
      <small>
        {alertLevel === 'critical'
          ? `Autonomía aproximada: ${rangeKilometers.toFixed(0)} km`
          : `Estación más cercana: ${formatDistance(destination.distanceMeters)}`}
      </small>
      <div className="fuel-assist__actions">
        <button
          type="button"
          className="fuel-assist__primary"
          disabled={hasFuelRoute}
          onClick={() => markFuelStationRoute(destination.station.id)}
        >
          {hasFuelRoute
            ? 'Ruta marcada'
            : alertLevel === 'critical'
              ? 'Ir a estación'
              : 'Marcar ruta'}
        </button>
        {alertLevel === 'critical' && (
          <button
            type="button"
            disabled={canisterCount === 0}
            onClick={useFuelCanister}
          >
            Usar bidón{canisterCount > 0 ? ` (${String(canisterCount)})` : ''}
          </button>
        )}
        {hasFuelRoute && (
          <button type="button" onClick={clearNavigationTarget}>
            {activeMissionId ? 'Volver a misión' : 'Cancelar ruta'}
          </button>
        )}
      </div>
    </aside>
  );
}

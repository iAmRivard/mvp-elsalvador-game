import { useEffect, useMemo, useState } from 'react';
import {
  vehicleById,
  vehicleDefinitions,
  vehicleSkinFor,
} from '../../data/vehicles';
import { useGameStore } from '../../store/gameStore';
import type { VehicleDefinition, VehicleId } from '../../types/vehicles';

interface VehicleGarageDialogProps {
  open: boolean;
  onClose: () => void;
}

const garageStats: readonly {
  id: string;
  label: string;
  value: (vehicle: VehicleDefinition) => number;
  maximum: number;
}[] = [
  {
    id: 'speed',
    label: 'Velocidad',
    value: (vehicle) => vehicle.maximumSpeed,
    maximum: 30,
  },
  {
    id: 'acceleration',
    label: 'Aceleración',
    value: (vehicle) => vehicle.acceleration,
    maximum: 12,
  },
  {
    id: 'steering',
    label: 'Control',
    value: (vehicle) => vehicle.steering,
    maximum: 100,
  },
  {
    id: 'offroad',
    label: 'Offroad',
    value: (vehicle) => vehicle.offroadGrip,
    maximum: 1.25,
  },
  {
    id: 'durability',
    label: 'Durabilidad',
    value: (vehicle) => vehicle.durability,
    maximum: 1.3,
  },
] as const;

function statPercent(
  vehicle: VehicleDefinition,
  stat: (typeof garageStats)[number],
) {
  return Math.min(100, Math.max(8, (stat.value(vehicle) / stat.maximum) * 100));
}

export function VehicleGarageDialog({
  open,
  onClose,
}: VehicleGarageDialogProps) {
  const selectedVehicleId = useGameStore((state) => state.selectedVehicleId);
  const selectedVehicleSkinId = useGameStore(
    (state) => state.selectedVehicleSkinId,
  );
  const unlockedVehicleIds = useGameStore((state) => state.unlockedVehicleIds);
  const selectVehicle = useGameStore((state) => state.selectVehicle);
  const [pendingVehicleId, setPendingVehicleId] =
    useState<VehicleId>(selectedVehicleId);
  const [pendingSkinId, setPendingSkinId] = useState(selectedVehicleSkinId);
  const closeWithoutSaving = () => {
    setPendingVehicleId(selectedVehicleId);
    setPendingSkinId(selectedVehicleSkinId);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setPendingVehicleId(selectedVehicleId);
      setPendingSkinId(selectedVehicleSkinId);
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [onClose, open, selectedVehicleId, selectedVehicleSkinId]);

  const pendingVehicle = useMemo(
    () => vehicleById.get(pendingVehicleId) ?? vehicleDefinitions[0],
    [pendingVehicleId],
  );
  const pendingSkin = vehicleSkinFor(pendingVehicle.id, pendingSkinId);

  if (!open) return null;

  const chooseVehicle = (vehicle: VehicleDefinition) => {
    if (!unlockedVehicleIds.includes(vehicle.id)) return;
    setPendingVehicleId(vehicle.id);
    setPendingSkinId(vehicle.defaultSkinId);
  };

  return (
    <div className="garage-backdrop">
      <section
        className="garage-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="garage-title"
      >
        <header className="garage-dialog__header">
          <div>
            <span className="garage-dialog__eyebrow">Expedición</span>
            <h2 id="garage-title">Garaje</h2>
          </div>
          <button
            type="button"
            className="garage-dialog__close"
            aria-label="Cerrar garaje"
            onClick={closeWithoutSaving}
          >
            ×
          </button>
        </header>

        <div className="garage-vehicles" aria-label="Vehículos disponibles">
          {vehicleDefinitions.map((vehicle) => {
            const unlocked = unlockedVehicleIds.includes(vehicle.id);
            const active = pendingVehicle.id === vehicle.id;
            const skin = vehicleSkinFor(vehicle.id, vehicle.defaultSkinId);
            return (
              <button
                key={vehicle.id}
                type="button"
                className={`garage-vehicle${active ? ' garage-vehicle--active' : ''}`}
                aria-label={
                  unlocked
                    ? `Seleccionar ${vehicle.name}`
                    : `${vehicle.name} · Bloqueado`
                }
                aria-pressed={unlocked ? active : undefined}
                disabled={!unlocked}
                onClick={() => chooseVehicle(vehicle)}
              >
                <span
                  className="garage-vehicle__swatch"
                  style={
                    {
                      '--garage-vehicle-color': skin.bodyColorCss,
                      '--garage-vehicle-accent': skin.accentColorCss,
                    } as React.CSSProperties
                  }
                  aria-hidden="true"
                />
                <span className="garage-vehicle__copy">
                  <strong>{vehicle.name}</strong>
                  <small>
                    {unlocked ? vehicle.description : vehicle.unlockDescription}
                  </small>
                </span>
                <span className="garage-vehicle__state" aria-hidden="true">
                  {unlocked ? (active ? 'LISTO' : 'VER') : '🔒'}
                </span>
              </button>
            );
          })}
        </div>

        <section
          className="garage-detail"
          aria-labelledby="garage-vehicle-title"
          data-garage-vehicle-id={pendingVehicle.id}
        >
          <div className="garage-detail__intro">
            <span
              className="garage-detail__vehicle"
              style={
                {
                  '--garage-vehicle-color': pendingSkin.bodyColorCss,
                  '--garage-vehicle-accent': pendingSkin.accentColorCss,
                } as React.CSSProperties
              }
              aria-hidden="true"
            />
            <div>
              <span>Vehículo seleccionado</span>
              <h3 id="garage-vehicle-title">{pendingVehicle.name}</h3>
              <p>{pendingVehicle.description}</p>
            </div>
          </div>

          <dl className="garage-stats">
            {garageStats.map((stat) => (
              <div key={stat.id}>
                <dt>{stat.label}</dt>
                <dd>
                  <span
                    className="garage-stat__bar"
                    style={
                      {
                        '--garage-stat': `${statPercent(pendingVehicle, stat).toFixed(0)}%`,
                      } as React.CSSProperties
                    }
                    aria-hidden="true"
                  />
                  <span className="sr-only">
                    {statPercent(pendingVehicle, stat).toFixed(0)} de 100
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <fieldset className="garage-skins">
            <legend>Skin</legend>
            {pendingVehicle.skins.map((skin) => (
              <label key={skin.id}>
                <input
                  type="radio"
                  name="vehicle-skin"
                  value={skin.id}
                  checked={pendingSkin.id === skin.id}
                  onChange={() => setPendingSkinId(skin.id)}
                />
                <span style={{ backgroundColor: skin.bodyColorCss }} />
                {skin.name}
              </label>
            ))}
          </fieldset>
        </section>

        <footer className="garage-dialog__actions">
          <button type="button" onClick={closeWithoutSaving}>
            Cancelar
          </button>
          <button
            type="button"
            className="garage-dialog__confirm"
            onClick={() => {
              if (!selectVehicle(pendingVehicle.id, pendingSkin.id)) return;
              setPendingVehicleId(pendingVehicle.id);
              setPendingSkinId(pendingSkin.id);
              onClose();
            }}
          >
            Confirmar vehículo
          </button>
        </footer>
        <small className="garage-dialog__asset-note">
          Prototipos visuales locales · el modelo 3D se carga solo al conducir
        </small>
      </section>
    </div>
  );
}

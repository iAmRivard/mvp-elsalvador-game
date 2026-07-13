import { locationById } from '../../data/locations';
import { useGameStore } from '../../store/gameStore';

export function CurrentRegion() {
  const currentLocationId = useGameStore((state) => state.currentLocationId);
  const location = currentLocationId ? locationById.get(currentLocationId) : null;

  return (
    <div className="region-pill" aria-label="Región actual">
      <span className="region-pill__signal" aria-hidden="true" />
      <span className="region-pill__copy">
        <strong>{location?.department ?? 'El Salvador'}</strong>
        <small>{location?.name ?? 'En ruta'}</small>
      </span>
    </div>
  );
}

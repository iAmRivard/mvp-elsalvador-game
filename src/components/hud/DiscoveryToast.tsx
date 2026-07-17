import { useEffect } from 'react';
import { locationById } from '../../data/locations';
import { useGameStore } from '../../store/gameStore';

interface DiscoveryToastProps {
  compact?: boolean;
}

export const DISCOVERY_TOAST_MILLISECONDS = 2_750;

export function DiscoveryToast({ compact = false }: DiscoveryToastProps) {
  const locationId = useGameStore((state) => state.lastDiscoveredLocationId);
  const dismissDiscovery = useGameStore((state) => state.dismissDiscovery);
  const location = locationId ? locationById.get(locationId) : null;

  useEffect(() => {
    if (!locationId) return;
    const timeout = window.setTimeout(
      dismissDiscovery,
      DISCOVERY_TOAST_MILLISECONDS,
    );
    return () => window.clearTimeout(timeout);
  }, [dismissDiscovery, locationId]);

  if (!location) return null;

  return (
    <aside
      className={`discovery-toast ${compact ? 'discovery-toast--compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="discovery-toast__icon" aria-hidden="true">
        ✦
      </span>
      <div>
        <span>Nueva ubicación descubierta</span>
        <strong>{location.name}</strong>
        <small>{location.department}</small>
      </div>
      <button
        type="button"
        aria-label="Cerrar notificación"
        onClick={dismissDiscovery}
      >
        ×
      </button>
    </aside>
  );
}

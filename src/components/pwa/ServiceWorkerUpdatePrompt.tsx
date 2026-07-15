import { useEffect, useState } from 'react';
import {
  requestServiceWorkerUpdate,
  SERVICE_WORKER_UPDATE_READY_EVENT,
  type ServiceWorkerUpdateReadyDetail,
} from './serviceWorkerUpdates';

interface ServiceWorkerUpdatePromptProps {
  deferUpdate?: boolean;
}

export function ServiceWorkerUpdatePrompt({
  deferUpdate = false,
}: ServiceWorkerUpdatePromptProps) {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleUpdate = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<ServiceWorkerUpdateReadyDetail>;
      setRegistration(event.detail.registration);
    };
    window.addEventListener(SERVICE_WORKER_UPDATE_READY_EVENT, handleUpdate);
    void navigator.serviceWorker
      .getRegistration()
      .then((current) => {
        if (current?.waiting) setRegistration(current);
      })
      .catch(() => undefined);

    return () => {
      window.removeEventListener(
        SERVICE_WORKER_UPDATE_READY_EVENT,
        handleUpdate,
      );
    };
  }, []);

  if (!registration) return null;

  const applyUpdate = () => {
    if (deferUpdate || applying) return;
    setApplying(true);
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true },
    );
    if (!requestServiceWorkerUpdate(registration)) {
      setApplying(false);
      setRegistration(null);
    }
  };

  return (
    <aside className="service-worker-update" role="status" aria-live="polite">
      <span>
        {deferUpdate
          ? 'Nueva versión lista. Podrás actualizar al terminar la misión.'
          : 'Nueva versión lista para instalar.'}
      </span>
      <button
        type="button"
        disabled={deferUpdate || applying}
        onClick={applyUpdate}
      >
        {applying ? 'Actualizando…' : 'Actualizar ahora'}
      </button>
    </aside>
  );
}

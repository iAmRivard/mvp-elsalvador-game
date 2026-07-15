export const SERVICE_WORKER_UPDATE_READY_EVENT =
  'rutas-perdidas:service-worker-update-ready';

export interface ServiceWorkerUpdateReadyDetail {
  registration: ServiceWorkerRegistration;
}

export function announceServiceWorkerUpdate(
  registration: ServiceWorkerRegistration,
): void {
  window.dispatchEvent(
    new CustomEvent<ServiceWorkerUpdateReadyDetail>(
      SERVICE_WORKER_UPDATE_READY_EVENT,
      { detail: { registration } },
    ),
  );
}

export function requestServiceWorkerUpdate(
  registration: ServiceWorkerRegistration,
): boolean {
  if (!registration.waiting) return false;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

function trackRegistration(registration: ServiceWorkerRegistration): void {
  if (registration.waiting) announceServiceWorkerUpdate(registration);

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (
        installing.state === 'installed' &&
        navigator.serviceWorker.controller
      ) {
        announceServiceWorkerUpdate(registration);
      }
    });
  });
}

export function registerServiceWorkerWithUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker
        .register('/sw.js')
        .then(trackRegistration)
        .catch(() => undefined);
    },
    { once: true },
  );
}

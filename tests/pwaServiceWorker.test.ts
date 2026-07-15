// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  announceServiceWorkerUpdate,
  requestServiceWorkerUpdate,
  SERVICE_WORKER_UPDATE_READY_EVENT,
  type ServiceWorkerUpdateReadyDetail,
} from '../src/components/pwa/serviceWorkerUpdates';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('actualización segura del service worker', () => {
  it('anuncia una actualización para que la interfaz decida cuándo aplicarla', () => {
    const registration = {} as ServiceWorkerRegistration;
    let received: ServiceWorkerRegistration | undefined;
    window.addEventListener(
      SERVICE_WORKER_UPDATE_READY_EVENT,
      (rawEvent) => {
        received = (rawEvent as CustomEvent<ServiceWorkerUpdateReadyDetail>)
          .detail.registration;
      },
      { once: true },
    );

    announceServiceWorkerUpdate(registration);

    expect(received).toBe(registration);
  });

  it('activa la espera solo por una solicitud explícita', () => {
    const postMessage = vi.fn();
    const registration = {
      waiting: { postMessage },
    } as unknown as ServiceWorkerRegistration;

    expect(requestServiceWorkerUpdate(registration)).toBe(true);
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'SKIP_WAITING',
    });
    expect(
      requestServiceWorkerUpdate({
        waiting: null,
      } as ServiceWorkerRegistration),
    ).toBe(false);
  });
});

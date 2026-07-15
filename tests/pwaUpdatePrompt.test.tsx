// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceWorkerUpdatePrompt } from '../src/components/pwa/ServiceWorkerUpdatePrompt';
import { announceServiceWorkerUpdate } from '../src/components/pwa/serviceWorkerUpdates';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('aviso de actualización PWA', () => {
  it('difiere la activación durante una misión y exige un clic explícito', () => {
    const postMessage = vi.fn();
    const addEventListener = vi.fn();
    const registration = {
      waiting: { postMessage },
    } as unknown as ServiceWorkerRegistration;
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener,
        getRegistration: vi.fn(() => Promise.resolve(undefined)),
      },
    });

    const view = render(<ServiceWorkerUpdatePrompt deferUpdate />);
    act(() => {
      announceServiceWorkerUpdate(registration);
    });

    const updateButton = screen.getByRole('button', {
      name: 'Actualizar ahora',
    });
    expect((updateButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(updateButton);
    expect(postMessage).not.toHaveBeenCalled();

    view.rerender(<ServiceWorkerUpdatePrompt deferUpdate={false} />);
    expect((updateButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(updateButton);

    expect(postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'SKIP_WAITING',
    });
    expect(addEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
      { once: true },
    );
  });
});

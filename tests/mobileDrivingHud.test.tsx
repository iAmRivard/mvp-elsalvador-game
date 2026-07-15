// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MobileDrivingHud } from '../src/components/hud/MobileDrivingHud';
import { useGameStore } from '../src/store/gameStore';

afterEach(cleanup);

describe('HUD móvil de conducción', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useGameStore.setState((state) => ({
      presentationMode: 'fast',
      activeMissionId: 'la-transmision',
      telemetry: {
        ...state.telemetry,
        speedMetersPerSecond: 17,
        speedKilometersPerHour: 61.2,
        fuel: 74,
      },
      vehicle: { ...state.vehicle, condition: 99 },
      missionRoute: {
        ...state.missionRoute,
        distanceMeters: 1_400,
        nextInstruction: {
          type: 'turn-left',
          coordinates: [-89.2, 13.7],
          distanceFromPreviousMeters: 230,
          distanceFromRouteStartMeters: 230,
          routeCoordinateIndex: 1,
          text: 'Gira a la izquierda',
        },
        distanceToNextInstructionMeters: 230,
      },
    }));
  });

  it('prioriza maniobra y vitales sin XP, energía ni telemetría secundaria', () => {
    render(<MobileDrivingHud />);

    expect(screen.getByTestId('mobile-driving-hud')).toBeTruthy();
    expect(screen.getByText(/Gira a la izquierda/i)).toBeTruthy();
    expect(screen.getByTestId('mobile-driving-speed').textContent).toBe(
      '61 km/h',
    );
    expect(screen.getByText('⛽ 74%')).toBeTruthy();
    expect(screen.getByText('🔧 99%')).toBeTruthy();
    expect(screen.queryByText(/XP|Energía|Posición|Recorrido/)).toBeNull();
  });

  it('abre la bitácora desde el bloque de navegación', () => {
    render(<MobileDrivingHud />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Abrir bitácora de la misión' }),
    );
    expect(useGameStore.getState().storyLogRequest).toMatchObject({
      section: 'missions',
      revision: 1,
    });
  });
});

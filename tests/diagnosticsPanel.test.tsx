// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagnosticsPanel } from '../src/components/dev/DiagnosticsPanel';
import { InputController } from '../src/game/inputController';
import { useSettingsStore } from '../src/store/settingsStore';

describe('panel de diagnóstico', () => {
  afterEach(cleanup);

  it('muestra métricas del mapa y el estado actual del input', () => {
    const map = document.createElement('div');
    map.className = 'map-canvas';
    map.dataset.runtimeFps = '50.0';
    map.dataset.roadNetworkStatus = 'ready';
    map.dataset.roadSelectedEdge = '42';
    map.dataset.roadPreviousEdge = '41';
    map.dataset.roadDistanceMeters = '3.4';
    map.dataset.roadContactSurface = 'secondary';
    map.dataset.roadConsecutiveMisses = '1';
    map.dataset.roadGraceRemainingMs = '900';
    map.dataset.roadDiagnosticExport = '{"lastEdgeId":42}';
    map.dataset.roadSelectedScore = '88.20';
    map.dataset.roadSearchMs = '0.120';
    map.dataset.routeExpandedNodes = '93';
    map.dataset.routeCacheHits = '2';
    map.dataset.routeCacheEntries = '4';
    document.body.append(map);
    useSettingsStore.setState({ controlMode: 'joystick-auto-throttle' });
    const input = new InputController();
    input.setJoystickTurn(0.45);
    input.setAutoThrottle(true);

    render(<DiagnosticsPanel input={input} />);

    expect(screen.getByText('50.0 / 20.0 ms')).toBeTruthy();
    expect(screen.getByText('0.72 / 0.45')).toBeTruthy();
    expect(screen.getByText('joystick-auto-throttle')).toBeTruthy();
    expect(screen.getByText('42 / 41')).toBeTruthy();
    expect(screen.getByText('3.4 m / secondary')).toBeTruthy();
    expect(screen.getByText('1 / 900 ms')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Copiar diagnóstico vial' }),
    ).toBeTruthy();
    expect(screen.getByText('93 / 2 hits / 4')).toBeTruthy();

    map.remove();
  });
});

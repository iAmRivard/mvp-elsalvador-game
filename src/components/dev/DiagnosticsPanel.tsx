import { useEffect, useState } from 'react';
import type { InputController } from '../../game/inputController';
import { useSettingsStore } from '../../store/settingsStore';

interface DiagnosticsPanelProps {
  input: InputController;
}

interface RuntimeDiagnosticsSnapshot {
  fps: string;
  frameMilliseconds: string;
  throttle: string;
  turn: string;
  pointer: string;
  cruise: string;
  roadStatus: string;
  roadSurface: string;
  roadEdge: string;
  roadDistance: string;
  roadScore: string;
  candidateScores: string;
  roadSearchMilliseconds: string;
  routeMilliseconds: string;
  workerMilliseconds: string;
  expandedNodes: string;
  routeCache: string;
  roadLoadMilliseconds: string;
  roadIndexMilliseconds: string;
  roadMemoryMegabytes: string;
  heapMemoryMegabytes: string;
}

const unavailable = '—';

function value(value: string | undefined, suffix = ''): string {
  return value ? `${value}${suffix}` : unavailable;
}

function readRuntimeDiagnostics(
  input: InputController,
): RuntimeDiagnosticsSnapshot {
  const dataset = document.querySelector<HTMLElement>('.map-canvas')?.dataset;
  const fps = Number(dataset?.runtimeFps);
  const inputDiagnostics = input.getDiagnostics();
  return {
    fps: value(dataset?.runtimeFps),
    frameMilliseconds:
      Number.isFinite(fps) && fps > 0 ? (1_000 / fps).toFixed(1) : unavailable,
    throttle: inputDiagnostics.throttle.toFixed(2),
    turn: inputDiagnostics.turn.toFixed(2),
    pointer: inputDiagnostics.pointerActive ? 'activo' : 'libre',
    cruise: inputDiagnostics.autoThrottleStatus,
    roadStatus: value(dataset?.roadNetworkStatus),
    roadSurface: value(dataset?.roadSurface),
    roadEdge: value(dataset?.roadSelectedEdge),
    roadDistance: value(dataset?.roadDistanceMeters, ' m'),
    roadScore: value(dataset?.roadSelectedScore),
    candidateScores:
      dataset?.roadCandidateScores?.split(',').slice(0, 4).join(' · ') ||
      unavailable,
    roadSearchMilliseconds: value(dataset?.roadSearchMs, ' ms'),
    routeMilliseconds: value(dataset?.routeCalculationMs, ' ms'),
    workerMilliseconds: value(dataset?.routeWorkerMs, ' ms'),
    expandedNodes: value(dataset?.routeExpandedNodes),
    routeCache:
      dataset?.routeCacheHits || dataset?.routeCacheEntries
        ? `${dataset.routeCacheHits ?? '0'} hits / ${dataset.routeCacheEntries ?? '0'}`
        : unavailable,
    roadLoadMilliseconds: value(dataset?.roadLoadMs, ' ms'),
    roadIndexMilliseconds: value(dataset?.roadIndexMs, ' ms'),
    roadMemoryMegabytes: value(dataset?.roadMemoryMb, ' MiB'),
    heapMemoryMegabytes: value(dataset?.memoryMb, ' MiB'),
  };
}

export function DiagnosticsPanel({ input }: DiagnosticsPanelProps) {
  const controlMode = useSettingsStore((state) => state.controlMode);
  const [snapshot, setSnapshot] = useState<RuntimeDiagnosticsSnapshot>(() =>
    readRuntimeDiagnostics(input),
  );

  useEffect(() => {
    const refresh = () => setSnapshot(readRuntimeDiagnostics(input));
    refresh();
    const interval = window.setInterval(refresh, 250);
    return () => window.clearInterval(interval);
  }, [input]);

  return (
    <details className="diagnostics-panel" open>
      <summary>Diagnóstico</summary>
      <dl>
        <dt>FPS / frame</dt>
        <dd>
          {snapshot.fps} / {snapshot.frameMilliseconds} ms
        </dd>
        <dt>Throttle / turn</dt>
        <dd>
          {snapshot.throttle} / {snapshot.turn}
        </dd>
        <dt>Modo móvil</dt>
        <dd>{controlMode}</dd>
        <dt>Puntero / crucero</dt>
        <dd>
          {snapshot.pointer} / {snapshot.cruise}
        </dd>
        <dt>Red / superficie</dt>
        <dd>
          {snapshot.roadStatus} / {snapshot.roadSurface}
        </dd>
        <dt>Edge / distancia</dt>
        <dd>
          {snapshot.roadEdge} / {snapshot.roadDistance}
        </dd>
        <dt>Score / búsqueda</dt>
        <dd>
          {snapshot.roadScore} / {snapshot.roadSearchMilliseconds}
        </dd>
        <dt>Candidatos</dt>
        <dd>{snapshot.candidateScores}</dd>
        <dt>Ruta total / worker</dt>
        <dd>
          {snapshot.routeMilliseconds} / {snapshot.workerMilliseconds}
        </dd>
        <dt>Nodos / caché</dt>
        <dd>
          {snapshot.expandedNodes} / {snapshot.routeCache}
        </dd>
        <dt>Carga / índice</dt>
        <dd>
          {snapshot.roadLoadMilliseconds} / {snapshot.roadIndexMilliseconds}
        </dd>
        <dt>Memoria vial / JS</dt>
        <dd>
          {snapshot.roadMemoryMegabytes} / {snapshot.heapMemoryMegabytes}
        </dd>
      </dl>
    </details>
  );
}

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
  joystickMilliseconds: string;
  pointer: string;
  cruise: string;
  targetSpeed: string;
  targetGear: string;
  roadStatus: string;
  roadSurface: string;
  roadEdge: string;
  roadPreviousEdge: string;
  roadDistance: string;
  roadContactSurface: string;
  roadMisses: string;
  roadGrace: string;
  roadReason: string;
  roadDiagnosticExport: string;
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
  presentationMode: string;
  cameraProfile: string;
  cameraUpdateMilliseconds: string;
  cameraUpdatesPerSecond: string;
  cameraInterruptedTransitions: string;
  followOffsetY: string;
  declutterProfile: string;
  declutterMilliseconds: string;
  visibleLayers: string;
  renderedSymbols: string;
  playerHudRenders: string;
  mobileHudRenders: string;
  radioRenders: string;
  missionPanelRenders: string;
  journalSheetRenders: string;
  activeOverlays: string;
}

const unavailable = '—';

function value(value: string | undefined, suffix = ''): string {
  return value ? `${value}${suffix}` : unavailable;
}

function readRuntimeDiagnostics(
  input: InputController,
): RuntimeDiagnosticsSnapshot {
  const dataset = document.querySelector<HTMLElement>('.map-canvas')?.dataset;
  const joystickDataset =
    document.querySelector<HTMLElement>('.virtual-joystick')?.dataset;
  const missionDataset =
    document.querySelector<HTMLElement>('.mission-panel')?.dataset;
  const playerHudDataset =
    document.querySelector<HTMLElement>('.player-hud')?.dataset;
  const mobileHudDataset = document.querySelector<HTMLElement>(
    '.mobile-driving-hud',
  )?.dataset;
  const radioDataset =
    document.querySelector<HTMLElement>('.radio-message')?.dataset;
  const overlayDataset =
    document.querySelector<HTMLElement>('.overlay-manager')?.dataset;
  const fps = Number(dataset?.runtimeFps);
  const inputDiagnostics = input.getDiagnostics();
  return {
    fps: value(dataset?.runtimeFps),
    frameMilliseconds:
      Number.isFinite(fps) && fps > 0 ? (1_000 / fps).toFixed(1) : unavailable,
    throttle: inputDiagnostics.throttle.toFixed(2),
    turn: inputDiagnostics.turn.toFixed(2),
    joystickMilliseconds: value(joystickDataset?.processingMs, ' ms'),
    pointer: inputDiagnostics.pointerActive ? 'activo' : 'libre',
    cruise: inputDiagnostics.autoThrottleStatus,
    targetSpeed: `${inputDiagnostics.mobileCruise.targetSpeedKilometersPerHour.toFixed(0)} km/h`,
    targetGear: inputDiagnostics.mobileCruise.reversing
      ? 'reverse'
      : inputDiagnostics.mobileCruise.selectedGear,
    roadStatus: value(dataset?.roadNetworkStatus),
    roadSurface: value(dataset?.roadSurface),
    roadEdge: value(dataset?.roadSelectedEdge),
    roadPreviousEdge: value(dataset?.roadPreviousEdge),
    roadDistance: value(dataset?.roadDistanceMeters, ' m'),
    roadContactSurface: value(dataset?.roadContactSurface),
    roadMisses: value(dataset?.roadConsecutiveMisses),
    roadGrace: value(dataset?.roadGraceRemainingMs, ' ms'),
    roadReason: value(dataset?.roadOffroadReason),
    roadDiagnosticExport: dataset?.roadDiagnosticExport ?? '',
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
    presentationMode: value(dataset?.presentationMode),
    cameraProfile: value(dataset?.currentCameraProfile),
    cameraUpdateMilliseconds: value(dataset?.cameraAverageUpdateMs, ' ms'),
    cameraUpdatesPerSecond: value(dataset?.cameraUpdatesPerSecond, '/s'),
    cameraInterruptedTransitions: value(dataset?.cameraInterruptedTransitions),
    followOffsetY: value(dataset?.followOffsetY, ' px'),
    declutterProfile: value(dataset?.mapDeclutterProfile),
    declutterMilliseconds: value(dataset?.mapDeclutterChangeMs, ' ms'),
    visibleLayers:
      dataset?.mapVisibleLayerCount && dataset?.mapLayerCount
        ? `${dataset.mapVisibleLayerCount}/${dataset.mapLayerCount}`
        : unavailable,
    renderedSymbols: value(dataset?.renderedSymbolCount),
    playerHudRenders: value(playerHudDataset?.renderCount),
    mobileHudRenders: value(mobileHudDataset?.renderCount),
    radioRenders: value(radioDataset?.renderCount),
    missionPanelRenders: value(missionDataset?.renderCount),
    journalSheetRenders: value(missionDataset?.sheetRenderCount),
    activeOverlays: overlayDataset?.activeOverlay
      ? `${overlayDataset.activeOverlay} (+${overlayDataset.queuedOverlays ?? '0'})`
      : unavailable,
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
        <dt>Tiempo joystick</dt>
        <dd>{snapshot.joystickMilliseconds}</dd>
        <dt>Modo móvil</dt>
        <dd>{controlMode}</dd>
        <dt>Puntero / crucero</dt>
        <dd>
          {snapshot.pointer} / {snapshot.cruise}
        </dd>
        <dt>Objetivo / marcha</dt>
        <dd>
          {snapshot.targetSpeed} / {snapshot.targetGear}
        </dd>
        <dt>Red / superficie</dt>
        <dd>
          {snapshot.roadStatus} / {snapshot.roadSurface}
        </dd>
        <dt>Edge actual / anterior</dt>
        <dd>
          {snapshot.roadEdge} / {snapshot.roadPreviousEdge}
        </dd>
        <dt>Distancia / superficie</dt>
        <dd>
          {snapshot.roadDistance} / {snapshot.roadContactSurface}
        </dd>
        <dt>Misses / gracia</dt>
        <dd>
          {snapshot.roadMisses} / {snapshot.roadGrace}
        </dd>
        <dt>Motivo offroad</dt>
        <dd>{snapshot.roadReason}</dd>
        <dt>Exportar</dt>
        <dd>
          <button
            type="button"
            disabled={!snapshot.roadDiagnosticExport}
            onClick={() => {
              if (snapshot.roadDiagnosticExport) {
                void navigator.clipboard?.writeText(
                  snapshot.roadDiagnosticExport,
                );
              }
            }}
          >
            Copiar diagnóstico vial
          </button>
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
        <dt>Presentación / cámara</dt>
        <dd>
          {snapshot.presentationMode} / {snapshot.cameraProfile}
        </dd>
        <dt>Cámara promedio / frecuencia</dt>
        <dd>
          {snapshot.cameraUpdateMilliseconds} /{' '}
          {snapshot.cameraUpdatesPerSecond}
        </dd>
        <dt>Offset / interrupciones</dt>
        <dd>
          {snapshot.followOffsetY} / {snapshot.cameraInterruptedTransitions}
        </dd>
        <dt>Declutter / cambio</dt>
        <dd>
          {snapshot.declutterProfile} / {snapshot.declutterMilliseconds}
        </dd>
        <dt>Capas / símbolos</dt>
        <dd>
          {snapshot.visibleLayers} / {snapshot.renderedSymbols}
        </dd>
        <dt>Renders HUD / móvil / radio</dt>
        <dd>
          {snapshot.playerHudRenders} / {snapshot.mobileHudRenders} /{' '}
          {snapshot.radioRenders}
        </dd>
        <dt>Renders misión / sheet</dt>
        <dd>
          {snapshot.missionPanelRenders} / {snapshot.journalSheetRenders}
        </dd>
        <dt>Overlay activo / cola</dt>
        <dd>{snapshot.activeOverlays}</dd>
      </dl>
    </details>
  );
}

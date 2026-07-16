import maplibregl, {
  type EaseToOptions,
  type ErrorEvent,
  type JumpToOptions,
} from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TouchControls } from '../game/TouchControls';
import { FuelStationLegend } from '../hud/FuelStationLegend';
import { gameConfig } from '../../config/game.config';
import {
  diagnosticsEnabled,
  performanceMetricsEnabled,
  performanceProfilingEnabled,
} from '../../config/diagnostics.config';
import {
  followCameraConfig,
  followCameraTolerances,
} from '../../config/followCamera.config';
import { mapSourceConfig, mapViewConfig } from '../../config/map.config';
import { roadAssistConfig } from '../../config/roadHandling.config';
import { autoThrottleConfig } from '../../config/mobileControls.config';
import { vehicleStateConfig } from '../../config/vehicleState.config';
import { missionById } from '../../data/missions';
import { restrictedAreaTypeAt } from '../../data/restrictedAreas';
import { detectDeviceProfile } from '../../game/deviceProfile';
import {
  buildFollowCameraUpdate,
  cameraProfileSpeedChangedSignificantly,
  drivingCameraProfile,
  followCameraOffset,
  followCameraTarget,
  mobileCameraModeForSpeed,
  mobileCameraTransitionCandidate,
  settledMobileCameraModeForSpeed,
  smoothFollowBearing,
  type FollowCameraOptions,
  type MobileCameraMode,
} from '../../game/followCamera';
import {
  effectiveDrivingSurfaceLabel,
  type DrivingPresentationMode,
} from '../../game/drivingPresentation';
import { startPlayerGameLoop, type PlayerGameLoop } from '../../game/gameLoop';
import {
  findDiscoverableLocations,
  findNearestLocation,
} from '../../game/discovery';
import {
  isInsideValidObjectiveZone,
  nearestPendingObjective,
  objectiveNarrativeCoordinates,
} from '../../game/missions';
import { selectedMissionChoiceOption } from '../../game/missionChoices';
import { InputController } from '../../game/inputController';
import {
  CLEAR_GAME_INPUT_EVENT,
  RESET_GAME_INPUT_EVENT,
} from '../../game/inputEvents';
import { triggerHaptic } from '../../game/haptics';
import { normalizeHeading } from '../../game/movement';
import { addFuelStationMarkers } from '../../map/fuelStationMarkers';
import { addLocationMarkers } from '../../map/locationMarkers';
import { addMissionRoute } from '../../map/missionRoute';
import {
  classifyMapRuntimeError,
  mapErrorDetails,
  mapErrorResourceUrl,
  mapLoadingLabels,
  mapRuntimeErrorStopsGameplay,
  type MapRuntimeErrorClassification,
  type MapLoadingStage,
} from '../../map/mapStartup';
import { createPlayerMarkerElement } from '../../map/playerMarker';
import { PlayerVisualUpdateCoordinator } from '../../map/playerVisualUpdates';
import {
  registerPmtilesProtocol,
  subscribePmtilesProtocolFailures,
} from '../../map/pmtilesProtocol';
import { addRoadDebugLayer } from '../../map/roadDebugLayer';
import { addPlayableRoadSurfaceLayer } from '../../map/roadSurfaceLayer';
import { createStyleResourceTransform } from '../../map/styleResources';
import {
  createMapDeclutterController,
  type MapDeclutterController,
} from '../../map/mapDeclutter';
import type { ThreeGameLayerController } from '../../map/threeLayer';
import { shouldUseThreePlayer } from '../../map/threeTransforms';
import { loadRoadNetwork } from '../../roads/roadNetwork';
import { RoadTracker } from '../../roads/roadTracker';
import { alignedRoadHeading } from '../../roads/initialRoadPosition';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { PlayerRuntime, PlayerTelemetry } from '../../types/game';
import type { RoadContact } from '../../types/roads';

function runtimeFromTelemetry(telemetry: PlayerTelemetry): PlayerRuntime {
  return {
    longitude: telemetry.longitude,
    latitude: telemetry.latitude,
    heading: telemetry.heading,
    speedMetersPerSecond: telemetry.speedMetersPerSecond,
    fuel: telemetry.fuel,
    totalDistanceMeters: telemetry.totalDistanceMeters,
  };
}

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function percentile95(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
  ];
}

function syncInteractiveSignal(layer: ThreeGameLayerController): void {
  const state = useGameStore.getState();
  const mission = state.activeMissionId
    ? missionById.get(state.activeMissionId)
    : null;
  const next = mission
    ? nearestPendingObjective(
        mission,
        state.activeMissionCompletedObjectiveIds,
        [state.telemetry.longitude, state.telemetry.latitude],
      )
    : null;
  const objective = next?.objective;
  const coordinates = objective
    ? objectiveNarrativeCoordinates(objective)
    : null;
  const interactive =
    objective &&
    ['interact', 'collect', 'deliver', 'repair', 'refuel', 'choice'].includes(
      objective.type,
    );
  const visible =
    Boolean(coordinates) && Boolean(interactive) && Boolean(mission);

  if (!visible || !coordinates || !objective || !next) {
    layer.setInteractiveSignal({ visible: false });
    return;
  }

  layer.setInteractiveSignal({
    visible: true,
    longitude: coordinates[0],
    latitude: coordinates[1],
    nearby: next.distanceMeters <= objective.radiusMeters,
  });
}

interface GameMapProps {
  inputController: InputController;
  onExitToTitle: () => void;
}

export function GameMap({ inputController, onExitToTitle }: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported] = useState(supportsWebGl);
  const graphicsQuality = useSettingsStore((state) => state.graphicsQuality);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const ambientFog = useSettingsStore((state) => state.ambientFog);
  const movementBlockedBy = useGameStore(
    (state) => state.driving.movementBlockedBy,
  );
  const deviceProfile = useMemo(
    () => detectDeviceProfile(graphicsQuality, reduceMotion),
    [graphicsQuality, reduceMotion],
  );
  const threeEnabled =
    webglSupported &&
    shouldUseThreePlayer(gameConfig.enableThreePlayer, deviceProfile.quality);
  const threeProfileKey = `${deviceProfile.quality}:${String(deviceProfile.reducedMotion)}`;
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'error' | 'unsupported'
  >(() => (webglSupported ? 'loading' : 'unsupported'));
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingStage, setLoadingStage] = useState<MapLoadingStage>('map');
  const [retryRevision, setRetryRevision] = useState(0);
  const [threeResult, setThreeResult] = useState<{
    profileKey: string;
    status: 'ready' | 'fallback';
  }>({ profileKey: '', status: 'fallback' });
  const threeStatus = !threeEnabled
    ? 'disabled'
    : threeResult.profileKey === threeProfileKey
      ? threeResult.status
      : 'loading';

  useEffect(() => {
    if (!containerRef.current) return;

    if (!webglSupported) return;

    document.documentElement.dataset.graphicsQuality = deviceProfile.quality;
    document.documentElement.dataset.reducedMotion = String(
      deviceProfile.reducedMotion,
    );
    const unregisterProtocol = registerPmtilesProtocol();
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        center: mapViewConfig.center,
        zoom: mapViewConfig.zoom,
        minZoom: mapSourceConfig.minZoom,
        maxZoom: mapSourceConfig.maxZoom,
        pitch: Math.min(mapViewConfig.pitch, deviceProfile.maximumInitialPitch),
        bearing: mapViewConfig.bearing,
        maxBounds: mapViewConfig.bounds,
        attributionControl: false,
        canvasContextAttributes: { antialias: deviceProfile.antialias },
        cooperativeGestures: !deviceProfile.isTouch,
        pixelRatio: deviceProfile.pixelRatio,
        fadeDuration: deviceProfile.fadeDurationMilliseconds,
      });
    } catch (error) {
      unregisterProtocol();
      const details = mapErrorDetails(error);
      const failureFrame = window.requestAnimationFrame(() => {
        setErrorMessage(details);
        setStatus('error');
      });
      return () => window.cancelAnimationFrame(failureFrame);
    }
    const loadingFrame = window.requestAnimationFrame(() => {
      setStatus('loading');
      setLoadingStage('map');
      setErrorMessage('');
    });

    if (!deviceProfile.isCompact) {
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          visualizePitch: true,
        }),
        'bottom-right',
      );
      map.addControl(
        new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 120 }),
        'bottom-left',
      );
    }
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: mapSourceConfig.attribution,
      }),
      'bottom-right',
    );
    // MapLibre expands compact attribution on first render until the map moves.
    const attributionDetails = map
      .getContainer()
      .querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
    attributionDetails?.removeAttribute('open');
    attributionDetails?.classList.remove('maplibregl-compact-show');

    let playerMarker: maplibregl.Marker | null = null;
    let threeLayer: ThreeGameLayerController | null = null;
    let playerVisualUpdates: PlayerVisualUpdateCoordinator | null = null;
    let gameLoop: PlayerGameLoop | null = null;
    let removeLocationMarkers: (() => void) | null = null;
    let removeFuelStationMarkers: (() => void) | null = null;
    let removeMissionRoute: (() => void) | null = null;
    let removeRoadDebugLayer: (() => void) | null = null;
    let removeRoadSurfaceLayer: (() => void) | null = null;
    let unsubscribeRuntime: (() => void) | null = null;
    let unsubscribeSettings: (() => void) | null = null;
    let unsubscribePresentation: (() => void) | null = null;
    let mapDeclutter: MapDeclutterController | null = null;
    let lastCameraUpdate = 0;
    let lastFollowedLongitude = Number.NaN;
    let lastFollowedLatitude = Number.NaN;
    let lastFollowedHeading = Number.NaN;
    let lastFollowedSpeedKilometersPerHour = Number.NaN;
    let lastAppliedCameraOptions: FollowCameraOptions | null = null;
    let lastAppliedCameraProfileName: string | null = null;
    let wasFollowing = false;
    let recenterUntil = 0;
    let lastCameraBearing = Number.NaN;
    let mobileCameraMode: MobileCameraMode = 'stopped';
    let mobileCameraCandidateMode: MobileCameraMode = 'stopped';
    let mobileCameraCandidateSince = performance.now();
    let cameraRequestedUpdates = 0;
    let cameraAppliedUpdates = 0;
    let cameraSkippedByInterval = 0;
    let cameraSkippedByTolerance = 0;
    let cameraWindowRequestedUpdates = 0;
    let cameraWindowAppliedUpdates = 0;
    let cameraUpdateDurationTotal = 0;
    const cameraUpdateDurations: number[] = [];
    let cameraMetricsStartedAt = performance.now();
    let cameraInterruptedTransitions = 0;
    let cameraOffsetAppliedUpdates = 0;
    let cameraProfileTransitions = 0;
    let cameraFallbackMarkerUpdates = 0;
    let cameraThreePlayerUpdates = 0;
    let threeDrivingEffectsUpdates = 0;
    let effectActive = true;
    let roadTracker: RoadTracker | null = null;
    let roadContact: RoadContact | null = null;
    let activeRouteEdgeIds = new Set(
      useGameStore.getState().missionRoute.activeEdgeIds,
    );
    let roadNetworkEnabled = false;
    let lastBlockedImpactTimestamp = Number.NEGATIVE_INFINITY;
    let visualFrameCount = 0;
    let lastFrameSampleTimestamp = performance.now();
    let previousHapticSurface = useGameStore.getState().driving.surface;
    let interactionWasActive = false;
    let startupReady = false;
    let fatalMapErrorHandled = false;

    const recordMapErrorClassification = (
      classification: MapRuntimeErrorClassification,
    ) => {
      const container = containerRef.current;
      if (!container) return;
      container.dataset.mapLastErrorSeverity = classification.severity;
      container.dataset.mapLastErrorReason = classification.reason;
      container.dataset.mapLastErrorResource = classification.resourceKind;
      container.dataset.mapLastErrorDetails = classification.details;
      if (classification.severity !== 'fatal') {
        container.dataset.mapLastNonfatalError = classification.details;
      }
    };
    const stopForFatalMapError = (
      classification: MapRuntimeErrorClassification,
    ) => {
      if (fatalMapErrorHandled) return;
      fatalMapErrorHandled = true;
      startupReady = false;
      useGameStore.getState().setInsideValidObjectiveZone(false);
      inputController.clearAllInput();
      inputController.resetMobileBoostCompletely();
      setErrorMessage(classification.details);
      setStatus('error');
    };

    const updateObjectiveZonePresentation = (
      state = useGameStore.getState(),
    ) => {
      const mission = state.activeMissionId
        ? missionById.get(state.activeMissionId)
        : null;
      const playerCoordinates: [number, number] = [
        state.telemetry.longitude,
        state.telemetry.latitude,
      ];
      const next = mission
        ? nearestPendingObjective(
            mission,
            state.activeMissionCompletedObjectiveIds,
            playerCoordinates,
          )
        : null;
      const inside = Boolean(
        next &&
        isInsideValidObjectiveZone(next.objective, playerCoordinates, {
          nearestRoadEdgeId: roadContact?.edge.id ?? null,
          distanceToNearestRoadMeters:
            roadContact?.nearest.distanceMeters ?? null,
          expectedRoadEdgeIds: activeRouteEdgeIds,
          maximumRoadDistanceMeters: roadAssistConfig.disengageDistanceMeters,
          directRoadContactToleranceMeters:
            roadAssistConfig.fullAssistRadiusMeters,
        }),
      );
      if (inside !== state.insideValidObjectiveZone) {
        state.setInsideValidObjectiveZone(inside);
      }
      const objectiveCoordinates = next
        ? objectiveNarrativeCoordinates(next.objective)
        : null;
      let objectiveVisible = false;
      if (objectiveCoordinates && state.navigationTarget === null) {
        const projected = map.project(objectiveCoordinates);
        const mapContainer = map.getContainer();
        objectiveVisible =
          projected.x >= 0 &&
          projected.y >= 0 &&
          projected.x <= mapContainer.clientWidth &&
          projected.y <= mapContainer.clientHeight;
      }
      state.setCurrentMissionObjectiveVisibility(
        next?.objective.id ?? null,
        objectiveVisible,
      );
      const container = containerRef.current;
      if (container) {
        container.dataset.currentMissionObjectiveId = next?.objective.id ?? '';
        container.dataset.currentMissionObjectiveVisible =
          String(objectiveVisible);
        container.dataset.insideValidObjectiveZone = String(inside);
        container.dataset.drivingSurfaceLabel = effectiveDrivingSurfaceLabel(
          state.driving.surface,
          inside,
        );
      }
    };

    const finishStartup = () => {
      if (!effectActive || fatalMapErrorHandled) return;
      setLoadingStage('routes');
      window.requestAnimationFrame(() => {
        if (!effectActive || fatalMapErrorHandled) return;
        startupReady = true;
        setLoadingStage('ready');
        setStatus('ready');
      });
    };

    const roadContextFor = (
      player: PlayerRuntime,
      timestampMilliseconds = performance.now(),
    ) => ({
      heading: normalizeHeading(
        player.heading + (player.speedMetersPerSecond < -0.5 ? 180 : 0),
      ),
      activeRouteEdgeIds,
      mobile: deviceProfile.isTouch,
      timestampMilliseconds,
    });

    const mobileCameraModeForPlayer = (
      speedKilometersPerHour: number,
      presentationMode: DrivingPresentationMode,
      timestampMilliseconds: number,
      settleImmediately: boolean,
    ): MobileCameraMode => {
      const input = {
        speedKilometersPerHour,
        previousMode: mobileCameraMode,
        timeInStateMilliseconds: 0,
        hasAlert: presentationMode === 'alert',
        hasInteraction: presentationMode === 'interaction',
      };
      if (settleImmediately) {
        mobileCameraMode = settledMobileCameraModeForSpeed(input);
        mobileCameraCandidateMode = mobileCameraMode;
        mobileCameraCandidateSince = timestampMilliseconds;
        return mobileCameraMode;
      }
      const candidate = mobileCameraTransitionCandidate(input);
      if (candidate !== mobileCameraCandidateMode) {
        mobileCameraCandidateMode = candidate;
        mobileCameraCandidateSince = timestampMilliseconds;
      }
      const nextMode = mobileCameraModeForSpeed({
        ...input,
        timeInStateMilliseconds: settleImmediately
          ? Number.POSITIVE_INFINITY
          : Math.max(0, timestampMilliseconds - mobileCameraCandidateSince),
      });
      if (nextMode !== mobileCameraMode) {
        mobileCameraMode = nextMode;
        mobileCameraCandidateMode = mobileCameraTransitionCandidate({
          ...input,
          previousMode: nextMode,
        });
        mobileCameraCandidateSince = timestampMilliseconds;
      }
      return mobileCameraMode;
    };

    const cameraForPlayer = (
      player: PlayerRuntime,
      timestampMilliseconds = performance.now(),
      settleMobileModeImmediately = false,
    ) => {
      const presentationMode = useGameStore.getState().presentationMode;
      const speedKilometersPerHour =
        Math.abs(player.speedMetersPerSecond) * 3.6;
      const cameraMode: DrivingPresentationMode = deviceProfile.isTouch
        ? mobileCameraModeForPlayer(
            speedKilometersPerHour,
            presentationMode,
            timestampMilliseconds,
            settleMobileModeImmediately,
          )
        : presentationMode === 'alert' || presentationMode === 'interaction'
          ? speedKilometersPerHour > 55
            ? 'fast'
            : speedKilometersPerHour >= 5
              ? 'driving'
              : 'stopped'
          : presentationMode;
      const profile = drivingCameraProfile(cameraMode, deviceProfile.isTouch);
      const camera = followCameraTarget(cameraMode, deviceProfile.isTouch);
      const canvas = map.getCanvas();
      return {
        options: {
          center: [player.longitude, player.latitude] as [number, number],
          bearing: player.heading,
          zoom: Math.min(camera.zoom, mapSourceConfig.maxZoom),
          pitch: Math.min(camera.pitch, deviceProfile.maximumInitialPitch),
          offset: followCameraOffset(
            canvas.clientWidth,
            canvas.clientHeight,
            profile.offsetYRatio,
          ),
        },
        profile,
        profileName: deviceProfile.isTouch
          ? cameraMode === 'fast'
            ? 'mobileFast'
            : cameraMode === 'driving'
              ? 'mobileDriving'
              : 'mobileStopped'
          : cameraMode === 'fast'
            ? 'fast'
            : cameraMode === 'driving'
              ? 'urban'
              : 'stopped',
      };
    };
    const exposeCameraTarget = (
      camera: ReturnType<typeof cameraForPlayer>,
      appliedOptions: FollowCameraOptions,
    ) => {
      const container = containerRef.current;
      if (!container) return;
      container.dataset.followZoom = appliedOptions.zoom.toFixed(2);
      container.dataset.followPitch = appliedOptions.pitch.toFixed(1);
      container.dataset.followOffsetY = String(appliedOptions.offset[1]);
      container.dataset.currentCameraProfile = camera.profileName;
    };
    const exposeCameraMetrics = (timestampMilliseconds: number) => {
      const metricsDuration = timestampMilliseconds - cameraMetricsStartedAt;
      if (
        metricsDuration < followCameraConfig.metricWindowMilliseconds ||
        !containerRef.current
      ) {
        return;
      }
      const container = containerRef.current;
      container.dataset.cameraRequestedUpdates = String(cameraRequestedUpdates);
      container.dataset.cameraAppliedUpdates = String(cameraAppliedUpdates);
      container.dataset.cameraSkippedByInterval = String(
        cameraSkippedByInterval,
      );
      container.dataset.cameraSkippedByTolerance = String(
        cameraSkippedByTolerance,
      );
      container.dataset.cameraInterruptedTransitions = String(
        cameraInterruptedTransitions,
      );
      container.dataset.cameraOffsetAppliedUpdates = String(
        cameraOffsetAppliedUpdates,
      );
      container.dataset.cameraProfileTransitions = String(
        cameraProfileTransitions,
      );
      container.dataset.cameraRequestedUpdatesPerSecond = (
        (cameraWindowRequestedUpdates * 1_000) /
        metricsDuration
      ).toFixed(1);
      container.dataset.cameraAppliedUpdatesPerSecond = (
        (cameraWindowAppliedUpdates * 1_000) /
        metricsDuration
      ).toFixed(1);
      container.dataset.cameraUpdatesPerSecond =
        container.dataset.cameraAppliedUpdatesPerSecond;
      container.dataset.cameraAverageUpdateMs = (
        cameraUpdateDurationTotal / Math.max(1, cameraAppliedUpdates)
      ).toFixed(3);
      if (performanceMetricsEnabled) {
        const cameraP95 = percentile95(cameraUpdateDurations);
        if (cameraP95 !== null) {
          container.dataset.cameraP95UpdateMs = cameraP95.toFixed(3);
        }
      }
      cameraWindowRequestedUpdates = 0;
      cameraWindowAppliedUpdates = 0;
      cameraMetricsStartedAt = timestampMilliseconds;
    };
    const followCameraTransform = map.transform.clone();
    const applyFollowCamera = (
      camera: ReturnType<typeof cameraForPlayer>,
      {
        durationMilliseconds = 0,
        force = false,
      }: {
        durationMilliseconds?: number;
        force?: boolean;
      } = {},
    ) => {
      const update = buildFollowCameraUpdate(
        force ? null : lastAppliedCameraOptions,
        camera.options,
        followCameraTolerances,
      );
      if (!update.mapOptions || !update.appliedOptions) return update;

      if (map.isEasing()) cameraInterruptedTransitions += 1;
      if (durationMilliseconds > 0) {
        const mapOptions: EaseToOptions = {
          ...update.mapOptions,
          duration: durationMilliseconds,
          animate: true,
          essential: false,
          easing: (progress) => 1 - (1 - progress) ** 3,
        };
        map.easeTo(mapOptions);
      } else {
        followCameraTransform.apply(map.transform, false);
        followCameraTransform.setZoom(update.appliedOptions.zoom);
        followCameraTransform.setBearing(update.appliedOptions.bearing);
        followCameraTransform.setPitch(update.appliedOptions.pitch);
        followCameraTransform.setLocationAtPoint(
          maplibregl.LngLat.convert(update.appliedOptions.center),
          followCameraTransform.centerPoint.add(
            new maplibregl.Point(
              update.mapOptions.offset[0],
              update.mapOptions.offset[1],
            ),
          ),
        );
        const jumpOptions: JumpToOptions = {
          center: followCameraTransform.center,
          bearing: update.appliedOptions.bearing,
        };
        if (update.changes.zoom) jumpOptions.zoom = update.appliedOptions.zoom;
        if (update.changes.pitch) {
          jumpOptions.pitch = update.appliedOptions.pitch;
        }
        map.jumpTo(jumpOptions);
      }
      const exposeAppliedProjection = () => {
        const container = containerRef.current;
        if (!container) return;
        const canvas = map.getCanvas();
        const projected = map.project(update.appliedOptions!.center);
        container.dataset.cameraAppliedScreenOffsetX = (
          projected.x -
          canvas.clientWidth / 2
        ).toFixed(1);
        container.dataset.cameraAppliedScreenOffsetY = (
          projected.y -
          canvas.clientHeight / 2
        ).toFixed(1);
      };
      if (durationMilliseconds > 0) {
        void map.once('moveend', exposeAppliedProjection);
      } else {
        exposeAppliedProjection();
      }

      if (
        lastAppliedCameraProfileName !== null &&
        lastAppliedCameraProfileName !== camera.profileName
      ) {
        cameraProfileTransitions += 1;
      }
      lastAppliedCameraProfileName = camera.profileName;
      lastAppliedCameraOptions = update.appliedOptions;
      lastCameraBearing = update.appliedOptions.bearing;
      cameraOffsetAppliedUpdates += 1;
      exposeCameraTarget(camera, update.appliedOptions);
      if (containerRef.current) {
        containerRef.current.dataset.cameraLastOperation =
          durationMilliseconds > 0 ? 'easeTo' : 'jumpTo-offset-center';
        containerRef.current.dataset.cameraLastAppliedOffsetY = String(
          update.mapOptions.offset[1],
        );
      }
      return update;
    };
    const unbindKeyboard = inputController.bindKeyboard(
      window,
      useGameStore.getState().togglePaused,
      useGameStore.getState().requestMissionRouteRecalculation,
    );
    const clearInterruptedInput = () => {
      if (useGameStore.getState().isJournalOpen) {
        inputController.suspendForOverlay();
      } else {
        inputController.clearAllInput();
      }
    };
    const resetInput = () => {
      inputController.clearAllInput();
      inputController.resetMobileBoostCompletely();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') clearInterruptedInput();
    };
    window.addEventListener('blur', clearInterruptedInput);
    window.addEventListener('orientationchange', clearInterruptedInput);
    window.addEventListener(CLEAR_GAME_INPUT_EVENT, clearInterruptedInput);
    window.addEventListener(RESET_GAME_INPUT_EVENT, resetInput);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    unsubscribeSettings = useSettingsStore.subscribe((state, previousState) => {
      if (state.controlMode !== previousState.controlMode) {
        clearInterruptedInput();
      } else if (
        state.joystickPositionMode !== previousState.joystickPositionMode ||
        state.joystickSize !== previousState.joystickSize ||
        state.joystickDeadZone !== previousState.joystickDeadZone
      ) {
        inputController.clearPointerActions();
      }
    });

    const handleLoad = () => {
      setLoadingStage('roads');
      useGameStore.getState().setInsideValidObjectiveZone(false);
      updateObjectiveZonePresentation();
      const initialPlayer = runtimeFromTelemetry(
        useGameStore.getState().telemetry,
      );
      useGameStore.getState().setRoadNetworkStatus('loading');
      if (containerRef.current) {
        containerRef.current.dataset.roadNetworkStatus = 'loading';
      }
      void loadRoadNetwork()
        .then(
          ({
            network,
            index,
            loadDurationMilliseconds,
            fileSizeBytes,
            metrics,
          }) => {
            if (!effectActive) return;
            removeRoadSurfaceLayer = addPlayableRoadSurfaceLayer(map, network);
            roadTracker = new RoadTracker(index);
            const currentPlayer =
              gameLoop?.getPlayer() ??
              runtimeFromTelemetry(useGameStore.getState().telemetry);
            roadContact = roadTracker.update(
              [currentPlayer.longitude, currentPlayer.latitude],
              roadContextFor(currentPlayer),
            );
            if (
              roadContact &&
              roadContact.nearest.distanceMeters <=
                roadAssistConfig.disengageDistanceMeters
            ) {
              useGameStore
                .getState()
                .alignInitialPlayerToRoad(
                  roadContact.nearest.coordinates,
                  alignedRoadHeading(
                    currentPlayer.heading,
                    roadContact.nearest.heading,
                    roadContact.edge.oneWay,
                  ),
                );
            }
            roadNetworkEnabled = true;
            useGameStore.getState().setRoadNetworkStatus('ready');
            if (containerRef.current) {
              containerRef.current.dataset.roadNetworkStatus = 'ready';
              containerRef.current.dataset.roadLoadMs =
                loadDurationMilliseconds.toFixed(1);
              containerRef.current.dataset.roadFileBytes =
                String(fileSizeBytes);
              containerRef.current.dataset.roadDownloadMs =
                metrics.downloadDurationMilliseconds.toFixed(1);
              containerRef.current.dataset.roadParseMs =
                metrics.parseDurationMilliseconds.toFixed(1);
              containerRef.current.dataset.roadValidationMs =
                metrics.validationDurationMilliseconds.toFixed(1);
              containerRef.current.dataset.roadIndexMs =
                metrics.indexDurationMilliseconds.toFixed(1);
              containerRef.current.dataset.roadMemoryMb = (
                metrics.approximateMemoryBytes /
                1024 /
                1024
              ).toFixed(1);
            }
            finishStartup();
          },
        )
        .catch((error: unknown) => {
          if (!effectActive) return;
          roadNetworkEnabled = false;
          useGameStore.getState().setRoadNetworkStatus('unavailable');
          recordMapErrorClassification(
            classifyMapRuntimeError(error, {
              startupComplete: startupReady,
              resourceKind: 'road-network',
              primaryStyleUrl: mapSourceConfig.styleUrl,
              primaryArchiveUrl: mapSourceConfig.archiveUrl,
              primarySourceId: mapSourceConfig.sourceId,
            }),
          );
          if (containerRef.current) {
            containerRef.current.dataset.roadNetworkStatus = 'unavailable';
          }
          finishStartup();
        });
      playerMarker = new maplibregl.Marker({
        element: createPlayerMarkerElement(),
        anchor: 'center',
        rotationAlignment: 'map',
        pitchAlignment: 'map',
      })
        .setLngLat([initialPlayer.longitude, initialPlayer.latitude])
        .setRotation(initialPlayer.heading)
        .addTo(map);
      playerVisualUpdates = new PlayerVisualUpdateCoordinator({
        updateFallback: (player) => {
          if (!playerMarker) return;
          playerMarker
            .setLngLat([player.longitude, player.latitude])
            .setRotation(player.heading);
          cameraFallbackMarkerUpdates += 1;
        },
        updateThree: (player) => {
          if (!threeLayer) return;
          threeLayer.updatePlayer(player);
          cameraThreePlayerUpdates += 1;
        },
        setDrivingEffects: (offroad) => {
          if (!threeLayer) return false;
          threeLayer.setDrivingEffects(offroad);
          threeDrivingEffectsUpdates += 1;
          return true;
        },
      });
      if (containerRef.current) {
        containerRef.current.dataset.cameraFallbackMarkerUpdates = '0';
        containerRef.current.dataset.cameraThreePlayerUpdates = '0';
        containerRef.current.dataset.threeDrivingEffectsUpdates = '0';
      }
      removeLocationMarkers = addLocationMarkers(map);
      removeFuelStationMarkers = addFuelStationMarkers(map);
      removeMissionRoute = addMissionRoute(
        map,
        deviceProfile.mapDataUpdateIntervalMilliseconds,
        deviceProfile.reducedMotion,
      );
      mapDeclutter = createMapDeclutterController(map);
      map.getContainer().dataset.presentationMode =
        useGameStore.getState().presentationMode;
      mapDeclutter.apply(useGameStore.getState().presentationMode, true);
      unsubscribePresentation = useGameStore.subscribe(
        (state, previousState) => {
          if (state.presentationMode === previousState.presentationMode) return;
          map.getContainer().dataset.presentationMode = state.presentationMode;
          mapDeclutter?.apply(state.presentationMode);
        },
      );
      void addRoadDebugLayer(map)
        .then((removeLayer) => {
          if (effectActive) removeRoadDebugLayer = removeLayer;
          else removeLayer();
        })
        .catch((error: unknown) => {
          recordMapErrorClassification(
            classifyMapRuntimeError(error, {
              startupComplete: startupReady,
              resourceKind: 'decorative',
              primaryStyleUrl: mapSourceConfig.styleUrl,
              primaryArchiveUrl: mapSourceConfig.archiveUrl,
              primarySourceId: mapSourceConfig.sourceId,
            }),
          );
        });

      if (threeEnabled) {
        void import('../../map/threeLayer')
          .then(({ addThreeGameLayer }) => {
            if (!effectActive) return;
            try {
              threeLayer = addThreeGameLayer(map, {
                quality: deviceProfile.quality,
                mobile: deviceProfile.isCompact,
                reducedMotion: deviceProfile.reducedMotion,
                onPlayerReady: () => {
                  if (!effectActive) return;
                  playerVisualUpdates?.setFallbackHidden(true);
                  playerMarker
                    ?.getElement()
                    .classList.add('player-marker--fallback-hidden');
                  setThreeResult({
                    profileKey: threeProfileKey,
                    status: 'ready',
                  });
                },
                onPlayerError: () => {
                  if (effectActive) {
                    playerVisualUpdates?.setFallbackHidden(false);
                    playerMarker
                      ?.getElement()
                      .classList.remove('player-marker--fallback-hidden');
                    setThreeResult({
                      profileKey: threeProfileKey,
                      status: 'fallback',
                    });
                  }
                },
              });
              playerVisualUpdates?.update(
                gameLoop?.getPlayer() ?? initialPlayer,
                gameLoop?.getSurface() === 'offroad',
              );
              syncInteractiveSignal(threeLayer);
            } catch {
              setThreeResult({
                profileKey: threeProfileKey,
                status: 'fallback',
              });
            }
          })
          .catch(() => {
            if (!effectActive) return;
            setThreeResult({
              profileKey: threeProfileKey,
              status: 'fallback',
            });
          });
      }

      const initialCameraTimestamp = performance.now();
      const initialCamera = cameraForPlayer(
        initialPlayer,
        initialCameraTimestamp,
        true,
      );
      applyFollowCamera(initialCamera, { force: true });
      lastCameraUpdate = initialCameraTimestamp;
      lastFollowedLongitude = initialPlayer.longitude;
      lastFollowedLatitude = initialPlayer.latitude;
      lastFollowedHeading = initialPlayer.heading;
      lastFollowedSpeedKilometersPerHour =
        Math.abs(initialPlayer.speedMetersPerSecond) * 3.6;
      wasFollowing = useGameStore.getState().isFollowingPlayer;

      gameLoop = startPlayerGameLoop({
        initialPlayer,
        input: inputController,
        isPaused: () => {
          const state = useGameStore.getState();
          return !startupReady || state.isPaused || state.isJournalOpen;
        },
        getMovementOptions: () => {
          const roadContactTimestamp = performance.now();
          return {
            steeringSensitivity:
              useSettingsStore.getState().steeringSensitivity,
            roadAssistMode: useSettingsStore.getState().roadAssistMode,
            roadAssistStrengthMultiplier: deviceProfile.isTouch
              ? roadAssistConfig.mobileStrengthMultiplier
              : 1,
            roadNetworkEnabled,
            roadContact,
            roadContactAt: roadTracker
              ? (runtime) => {
                  roadContact =
                    roadTracker?.update(
                      [runtime.longitude, runtime.latitude],
                      roadContextFor(runtime, roadContactTimestamp),
                    ) ?? null;
                  return roadContact ?? null;
                }
              : undefined,
            restrictedAreaTypeAt,
            driveEnabled: useGameStore.getState().vehicle.condition > 0,
            routeFuelMultiplier:
              selectedMissionChoiceOption(
                useGameStore.getState().activeMissionId,
                useGameStore.getState().missionChoiceSelections,
              )?.fuelMultiplier ?? 1,
          };
        },
        onVisualUpdate: (player, timestamp) => {
          visualFrameCount += 1;
          const frameSampleDuration = timestamp - lastFrameSampleTimestamp;
          if (frameSampleDuration >= 1_000 && containerRef.current) {
            containerRef.current.dataset.runtimeFps = (
              (visualFrameCount * 1_000) /
              frameSampleDuration
            ).toFixed(1);
            containerRef.current.dataset.cameraFallbackMarkerUpdates = String(
              cameraFallbackMarkerUpdates,
            );
            containerRef.current.dataset.cameraThreePlayerUpdates = String(
              cameraThreePlayerUpdates,
            );
            containerRef.current.dataset.threeDrivingEffectsUpdates = String(
              threeDrivingEffectsUpdates,
            );
            if (diagnosticsEnabled) {
              const memory = (
                performance as Performance & {
                  memory?: { usedJSHeapSize: number };
                }
              ).memory;
              if (memory) {
                containerRef.current.dataset.memoryMb = (
                  memory.usedJSHeapSize /
                  1024 /
                  1024
                ).toFixed(1);
              }
              const symbolLayers = mapDeclutter?.inventory
                .filter(
                  (layer) => layer.type === 'symbol' && map.getLayer(layer.id),
                )
                .map((layer) => layer.id);
              if (symbolLayers?.length) {
                try {
                  containerRef.current.dataset.renderedSymbolCount = String(
                    map.queryRenderedFeatures({ layers: symbolLayers }).length,
                  );
                } catch {
                  containerRef.current.dataset.renderedSymbolCount = '0';
                }
              }
            }
            visualFrameCount = 0;
            lastFrameSampleTimestamp = timestamp;
          }
          playerVisualUpdates?.update(
            player,
            gameLoop?.getSurface() === 'offroad',
          );

          const isFollowing = useGameStore.getState().isFollowingPlayer;
          if (!isFollowing) {
            wasFollowing = false;
            recenterUntil = 0;
            return;
          }

          if (recenterUntil > timestamp) {
            wasFollowing = true;
            return;
          }

          const positionChanged =
            player.longitude !== lastFollowedLongitude ||
            player.latitude !== lastFollowedLatitude ||
            player.heading !== lastFollowedHeading;
          const speedKilometersPerHour =
            Math.abs(player.speedMetersPerSecond) * 3.6;
          const speedChanged = cameraProfileSpeedChangedSignificantly(
            lastFollowedSpeedKilometersPerHour,
            speedKilometersPerHour,
            followCameraTolerances,
          );
          const mobileCameraTransitionPending =
            deviceProfile.isTouch &&
            mobileCameraCandidateMode !== mobileCameraMode;
          if (
            !wasFollowing ||
            positionChanged ||
            speedChanged ||
            mobileCameraTransitionPending
          ) {
            cameraRequestedUpdates += 1;
            cameraWindowRequestedUpdates += 1;
            if (
              timestamp - lastCameraUpdate <
              deviceProfile.cameraUpdateIntervalMilliseconds
            ) {
              cameraSkippedByInterval += 1;
              exposeCameraMetrics(timestamp);
              wasFollowing = true;
              return;
            }
            const isRecentering = !wasFollowing;
            const cameraStartedAt = performance.now();
            const camera = cameraForPlayer(player, timestamp);
            const duration = deviceProfile.reducedMotion
              ? 0
              : isRecentering
                ? followCameraConfig.recenterDurationMilliseconds
                : 0;
            camera.options.bearing = smoothFollowBearing(
              lastCameraBearing,
              player.heading,
              deviceProfile.reducedMotion
                ? 360
                : followCameraConfig.maximumBearingChangeDegrees,
            );
            const cameraUpdate = applyFollowCamera(camera, {
              durationMilliseconds: duration,
              force: isRecentering,
            });
            if (!cameraUpdate.mapOptions) {
              cameraSkippedByTolerance += 1;
              lastCameraUpdate = timestamp;
              exposeCameraMetrics(timestamp);
              wasFollowing = true;
              return;
            }
            recenterUntil = isRecentering ? timestamp + duration : 0;
            lastCameraUpdate = timestamp;
            lastFollowedLongitude = player.longitude;
            lastFollowedLatitude = player.latitude;
            lastFollowedHeading = player.heading;
            lastFollowedSpeedKilometersPerHour = speedKilometersPerHour;
            const cameraUpdateDuration = performance.now() - cameraStartedAt;
            cameraAppliedUpdates += 1;
            cameraWindowAppliedUpdates += 1;
            cameraUpdateDurationTotal += cameraUpdateDuration;
            if (performanceMetricsEnabled) {
              cameraUpdateDurations.push(cameraUpdateDuration);
              if (
                cameraUpdateDurations.length >
                followCameraConfig.maximumDurationSamples
              ) {
                cameraUpdateDurations.shift();
              }
            }
            if (containerRef.current) {
              containerRef.current.dataset.cameraUpdateMs =
                cameraUpdateDuration.toFixed(3);
            }
            exposeCameraMetrics(timestamp);
          }
          wasFollowing = true;
        },
        onTelemetryUpdate: (
          player,
          movementSamples,
          elapsedRealTimeSeconds,
        ) => {
          const telemetryTimestamp = performance.now();
          const coordinates: [number, number] = [
            player.longitude,
            player.latitude,
          ];
          const state = useGameStore.getState();
          state.setTelemetry(player);
          if (state.isJournalOpen && !state.isPaused) {
            state.advanceActiveMission(player, false, elapsedRealTimeSeconds);
          }
          if (containerRef.current) {
            const inputDiagnostics = inputController.getDiagnostics();
            containerRef.current.dataset.playerLongitude =
              player.longitude.toFixed(7);
            containerRef.current.dataset.playerLatitude =
              player.latitude.toFixed(7);
            containerRef.current.dataset.playerSpeedKilometersPerHour = (
              Math.abs(player.speedMetersPerSecond) * 3.6
            ).toFixed(2);
            containerRef.current.dataset.playerFuel = player.fuel.toFixed(1);
            containerRef.current.dataset.vehicleCondition =
              state.vehicle.condition.toFixed(1);
            containerRef.current.dataset.inputThrottle =
              inputDiagnostics.throttle.toFixed(3);
            containerRef.current.dataset.inputTurn =
              inputDiagnostics.turn.toFixed(3);
            containerRef.current.dataset.inputBoost = String(
              inputDiagnostics.boost,
            );
            containerRef.current.dataset.inputMobileBoost = inputDiagnostics
              .mobileBoost.active
              ? 'active'
              : inputDiagnostics.mobileBoost.cooldownRemainingMilliseconds > 0
                ? 'cooldown'
                : 'off';
            containerRef.current.dataset.inputInteract = String(
              inputDiagnostics.interact,
            );
            if (performanceMetricsEnabled) {
              const inputLatency = inputController.getInputLatencyDiagnostics();
              containerRef.current.dataset.inputLatencySequence = String(
                inputLatency.sequence,
              );
              containerRef.current.dataset.inputStoredLatencyMs =
                inputLatency.eventToStoredMilliseconds?.toFixed(3) ?? '';
              containerRef.current.dataset.inputNextAnimationFrameLatencyMs =
                inputLatency.eventToNextAnimationFrameMilliseconds?.toFixed(
                  3,
                ) ?? '';
              containerRef.current.dataset.inputConsumptionLatencyMs =
                inputLatency.inputConsumptionLatencyMilliseconds?.toFixed(3) ??
                '';
            }
            containerRef.current.dataset.inputPointerActive = String(
              inputDiagnostics.pointerActive,
            );
            containerRef.current.dataset.inputAutoThrottle =
              inputDiagnostics.autoThrottleStatus;
            containerRef.current.dataset.inputTargetSpeed =
              inputDiagnostics.mobileCruise.targetSpeedKilometersPerHour.toFixed(
                1,
              );
            containerRef.current.dataset.inputCruiseGear =
              inputDiagnostics.mobileCruise.selectedGear;
            containerRef.current.dataset.inputCruiseBraking = String(
              inputDiagnostics.mobileCruise.braking,
            );
            containerRef.current.dataset.inputCruiseReversing = String(
              inputDiagnostics.mobileCruise.reversing,
            );
            containerRef.current.dataset.inputCruiseReverseState =
              inputDiagnostics.mobileCruise.reverseState;
          }
          if (roadTracker) {
            const metrics = roadTracker.getMetrics();
            if (containerRef.current) {
              containerRef.current.dataset.roadSearchMs =
                metrics.averageDurationMilliseconds.toFixed(3);
              containerRef.current.dataset.roadSearchLastMs =
                metrics.lastDurationMilliseconds.toFixed(3);
              containerRef.current.dataset.roadSearchCandidates = String(
                metrics.lastCandidateCount,
              );
              const roadDiagnostics = roadTracker.getDiagnostics();
              containerRef.current.dataset.roadSelectedEdge = String(
                roadDiagnostics.selectedEdgeId ?? '',
              );
              containerRef.current.dataset.roadPreviousEdge = String(
                roadDiagnostics.previousEdgeId ?? '',
              );
              containerRef.current.dataset.roadDistanceMeters =
                roadDiagnostics.nearestEdgeDistanceMeters?.toFixed(1) ?? '';
              containerRef.current.dataset.roadContactSurface =
                roadDiagnostics.surface;
              if (diagnosticsEnabled) {
                containerRef.current.dataset.roadSelectedScore =
                  roadDiagnostics.selectedScore?.toFixed(2) ?? '';
                containerRef.current.dataset.roadConsecutiveMisses = String(
                  roadDiagnostics.consecutiveMisses,
                );
                containerRef.current.dataset.roadGraceRemainingMs = String(
                  Math.round(roadDiagnostics.gracePeriodRemainingMilliseconds),
                );
                containerRef.current.dataset.roadOffroadReason =
                  roadDiagnostics.offroadReason ?? '';
                containerRef.current.dataset.roadContactSource =
                  roadDiagnostics.contactSource;
                containerRef.current.dataset.roadDiagnosticExport =
                  JSON.stringify(roadTracker.getDiagnosticExport());
                containerRef.current.dataset.roadCandidateScores =
                  roadDiagnostics.candidates
                    .map(
                      (candidate) =>
                        `${String(candidate.edgeId)}:${candidate.score.totalScore.toFixed(1)}`,
                    )
                    .join(',');
              }
            }
          }
          const environment =
            movementSamples.at(-1)?.environment ?? gameLoop?.getEnvironment();
          if (environment) {
            inputController.setAutoThrottleScale(
              environment.surface === 'offroad'
                ? autoThrottleConfig.offroadScale
                : 1,
            );
            state.setDrivingEnvironment(environment);
            const hapticsEnabled = useSettingsStore.getState().hapticsEnabled;
            for (const sample of movementSamples) {
              const blockedImpact =
                sample.environment.movementBlockedBy !== null &&
                telemetryTimestamp - lastBlockedImpactTimestamp >=
                  vehicleStateConfig.blockedImpactCooldownMilliseconds;
              if (blockedImpact) {
                lastBlockedImpactTimestamp = telemetryTimestamp;
              }
              if (
                sample.environment.surface === 'offroad' &&
                previousHapticSurface !== 'offroad'
              ) {
                triggerHaptic('offroad', hapticsEnabled);
              }
              if (blockedImpact) triggerHaptic('collision', hapticsEnabled);
              previousHapticSurface = sample.environment.surface;
              state.applyDrivingWear(
                sample.vehicleDistanceMeters,
                sample.environment.surface,
                blockedImpact,
                selectedMissionChoiceOption(
                  state.activeMissionId,
                  state.missionChoiceSelections,
                )?.conditionMultiplier ?? 1,
              );
            }
            if (containerRef.current) {
              containerRef.current.dataset.roadSurface = environment.surface;
              containerRef.current.dataset.movementBlockedBy =
                environment.movementBlockedBy ?? '';
            }
            updateObjectiveZonePresentation(useGameStore.getState());
            if (threeLayer) syncInteractiveSignal(threeLayer);
          }

          const nearestLocation = findNearestLocation(coordinates);
          state.setCurrentLocationId(nearestLocation?.id ?? null);

          const sampledPlayers =
            movementSamples.length > 0
              ? movementSamples.map((sample) => sample.player)
              : [player];
          for (const sampledPlayer of sampledPlayers) {
            const currentState = useGameStore.getState();
            const discoveries = findDiscoverableLocations(
              [sampledPlayer.longitude, sampledPlayer.latitude],
              currentState.discoveredLocationIds,
              currentState.unlockedLocationIds,
            );
            discoveries.forEach((location) =>
              useGameStore.getState().discoverLocation(location.id),
            );
          }

          for (const sample of movementSamples) {
            const currentState = useGameStore.getState();
            const interactionStarted =
              sample.input.interact && !interactionWasActive;
            interactionWasActive = sample.input.interact;
            if (
              currentState.isPaused ||
              currentState.recoveryReason ||
              currentState.activeNarrativeEventId
            ) {
              break;
            }
            const completedBefore =
              currentState.activeMissionCompletedObjectiveIds.length;
            currentState.advanceActiveMission(
              sample.player,
              interactionStarted,
              sample.deltaTimeSeconds,
            );
            if (interactionStarted) {
              inputController.releasePointerAction('interact');
            }
            if (
              useGameStore.getState().activeMissionCompletedObjectiveIds
                .length > completedBefore
            ) {
              triggerHaptic(
                'objective',
                useSettingsStore.getState().hapticsEnabled,
              );
            }
          }
        },
      });

      unsubscribeRuntime = useGameStore.subscribe((state, previousState) => {
        const objectiveStructureChanged =
          state.activeMissionId !== previousState.activeMissionId ||
          state.activeMissionCompletedObjectiveIds !==
            previousState.activeMissionCompletedObjectiveIds ||
          state.navigationTarget !== previousState.navigationTarget ||
          state.missionRoute.activeEdgeIds !==
            previousState.missionRoute.activeEdgeIds;
        if (
          state.missionRoute.activeEdgeIds !==
          previousState.missionRoute.activeEdgeIds
        ) {
          activeRouteEdgeIds = new Set(state.missionRoute.activeEdgeIds);
        }
        if (objectiveStructureChanged) {
          if (threeLayer) syncInteractiveSignal(threeLayer);
          updateObjectiveZonePresentation(state);
        }
        if (!previousState.isJournalOpen && state.isJournalOpen) {
          inputController.suspendForOverlay();
        } else if (
          (!previousState.isPaused && state.isPaused) ||
          (!previousState.recoveryReason && state.recoveryReason) ||
          (!previousState.activeNarrativeEventId &&
            state.activeNarrativeEventId) ||
          (!previousState.activeMissionChoiceObjectiveId &&
            state.activeMissionChoiceObjectiveId)
        ) {
          clearInterruptedInput();
        }
        if (previousState.recoveryReason && !state.recoveryReason) {
          inputController.resetMobileBoostCompletely();
        }
        if (state.needsInitialRoadAlignment && roadTracker) {
          const player = runtimeFromTelemetry(state.telemetry);
          const contact = roadTracker.update(
            [player.longitude, player.latitude],
            roadContextFor(player),
          );
          if (
            contact &&
            contact.nearest.distanceMeters <=
              roadAssistConfig.disengageDistanceMeters
          ) {
            useGameStore
              .getState()
              .alignInitialPlayerToRoad(
                contact.nearest.coordinates,
                alignedRoadHeading(
                  player.heading,
                  contact.nearest.heading,
                  contact.edge.oneWay,
                ),
              );
            return;
          }
        }
        if (
          state.playerRuntimeRevision === previousState.playerRuntimeRevision
        ) {
          return;
        }
        const restoredPlayer = runtimeFromTelemetry(state.telemetry);
        roadTracker?.reset();
        roadContact =
          roadTracker?.update(
            [restoredPlayer.longitude, restoredPlayer.latitude],
            roadContextFor(restoredPlayer),
          ) ?? null;
        gameLoop?.replacePlayer(restoredPlayer);
        playerVisualUpdates?.update(
          restoredPlayer,
          gameLoop?.getSurface() === 'offroad',
        );
        const restoredCameraTimestamp = performance.now();
        const restoredCamera = cameraForPlayer(
          restoredPlayer,
          restoredCameraTimestamp,
          true,
        );
        applyFollowCamera(restoredCamera, { force: true });
        lastCameraUpdate = restoredCameraTimestamp;
        lastFollowedLongitude = restoredPlayer.longitude;
        lastFollowedLatitude = restoredPlayer.latitude;
        lastFollowedHeading = restoredPlayer.heading;
        lastFollowedSpeedKilometersPerHour =
          Math.abs(restoredPlayer.speedMetersPerSecond) * 3.6;
        wasFollowing = state.isFollowingPlayer;
        recenterUntil = 0;
      });
    };
    const handleManualCameraStart = (event: { originalEvent?: Event }) => {
      if (event.originalEvent) {
        useGameStore.getState().setFollowingPlayer(false);
      }
    };
    const handleResize = () => {
      const player = gameLoop?.getPlayer();
      if (!player || !useGameStore.getState().isFollowingPlayer) return;
      const camera = cameraForPlayer(player, performance.now());
      const cameraUpdate = applyFollowCamera(camera);
      if (!cameraUpdate.mapOptions) return;
      lastCameraUpdate = performance.now();
    };
    const handleError = (event: ErrorEvent) => {
      const runtimeEvent = event as ErrorEvent & {
        sourceId?: string;
        source?: { url?: unknown };
      };
      const sourceUrl =
        typeof runtimeEvent.source?.url === 'string'
          ? runtimeEvent.source.url
          : null;
      const classification = classifyMapRuntimeError(event.error, {
        startupComplete: startupReady,
        resourceUrl: mapErrorResourceUrl(event.error) ?? sourceUrl,
        sourceId: runtimeEvent.sourceId,
        primaryStyleUrl: mapSourceConfig.styleUrl,
        primaryArchiveUrl: mapSourceConfig.archiveUrl,
        primarySourceId: mapSourceConfig.sourceId,
      });
      recordMapErrorClassification(classification);
      if (!mapRuntimeErrorStopsGameplay(classification)) {
        return;
      }
      stopForFatalMapError(classification);
    };
    const handleWebglContextLost = () => {
      const classification = classifyMapRuntimeError(
        new Error('WebGL context lost'),
        {
          startupComplete: startupReady,
          resourceKind: 'webgl',
          primaryStyleUrl: mapSourceConfig.styleUrl,
          primaryArchiveUrl: mapSourceConfig.archiveUrl,
          primarySourceId: mapSourceConfig.sourceId,
        },
      );
      recordMapErrorClassification(classification);
      stopForFatalMapError(classification);
    };
    const unsubscribePmtilesFailures = subscribePmtilesProtocolFailures(
      ({ error, requestUrl }) => {
        const classification = classifyMapRuntimeError(error, {
          startupComplete: startupReady,
          resourceKind: 'primary-source',
          resourceUrl: requestUrl,
          sourceId: mapSourceConfig.sourceId,
          persistent: true,
          primaryStyleUrl: mapSourceConfig.styleUrl,
          primaryArchiveUrl: mapSourceConfig.archiveUrl,
          primarySourceId: mapSourceConfig.sourceId,
        });
        recordMapErrorClassification(classification);
        stopForFatalMapError(classification);
      },
    );

    map.on('load', handleLoad);
    map.on('dragstart', handleManualCameraStart);
    map.on('zoomstart', handleManualCameraStart);
    map.on('rotatestart', handleManualCameraStart);
    map.on('pitchstart', handleManualCameraStart);
    map.on('resize', handleResize);
    map.on('error', handleError);
    map.on('webglcontextlost', handleWebglContextLost);
    map.setStyle(mapSourceConfig.styleUrl, {
      transformStyle: createStyleResourceTransform(window.location.href),
    });

    return () => {
      effectActive = false;
      window.cancelAnimationFrame(loadingFrame);
      map.off('load', handleLoad);
      map.off('dragstart', handleManualCameraStart);
      map.off('zoomstart', handleManualCameraStart);
      map.off('rotatestart', handleManualCameraStart);
      map.off('pitchstart', handleManualCameraStart);
      map.off('resize', handleResize);
      map.off('error', handleError);
      map.off('webglcontextlost', handleWebglContextLost);
      unsubscribePmtilesFailures();
      gameLoop?.stop();
      unsubscribeRuntime?.();
      unsubscribeSettings?.();
      unsubscribePresentation?.();
      mapDeclutter?.dispose();
      useGameStore.getState().setInsideValidObjectiveZone(false);
      removeLocationMarkers?.();
      removeFuelStationMarkers?.();
      removeMissionRoute?.();
      removeRoadDebugLayer?.();
      removeRoadSurfaceLayer?.();
      threeLayer?.remove();
      playerMarker?.remove();
      unbindKeyboard();
      window.removeEventListener('blur', clearInterruptedInput);
      window.removeEventListener('orientationchange', clearInterruptedInput);
      window.removeEventListener(CLEAR_GAME_INPUT_EVENT, clearInterruptedInput);
      window.removeEventListener(RESET_GAME_INPUT_EVENT, resetInput);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      inputController.clearAllInput();
      map.remove();
      unregisterProtocol();
      delete document.documentElement.dataset.graphicsQuality;
      delete document.documentElement.dataset.reducedMotion;
    };
  }, [
    deviceProfile,
    inputController,
    threeEnabled,
    threeProfileKey,
    webglSupported,
    retryRevision,
  ]);

  const retryMap = () => {
    inputController.clearAllInput();
    setStatus('loading');
    setLoadingStage('map');
    setErrorMessage('');
    setRetryRevision((revision) => revision + 1);
  };

  return (
    <div
      className={`map-frame map-frame--${deviceProfile.quality} ${movementBlockedBy ? 'map-frame--movement-blocked' : ''}`}
      data-device-layout={deviceProfile.isCompact ? 'compact' : 'full'}
      data-player-renderer={threeStatus}
    >
      <div
        ref={containerRef}
        className="map-canvas"
        data-testid="game-map"
        data-performance-profiling-enabled={String(performanceProfilingEnabled)}
        data-diagnostics-enabled={String(diagnosticsEnabled)}
      />

      <div className="map-vignette" aria-hidden="true" />
      {ambientFog && <div className="map-atmosphere" aria-hidden="true" />}

      {status === 'loading' && (
        <div className="map-message" role="status">
          <span className="map-message__spinner" aria-hidden="true" />
          {mapLoadingLabels[loadingStage]}
        </div>
      )}

      {status === 'ready' && (
        <span className="sr-only">El mapa local está listo.</span>
      )}

      {status === 'ready' && <FuelStationLegend />}

      {threeStatus === 'ready' && (
        <span className="sr-only">Vehículo 3D activo.</span>
      )}

      {threeStatus === 'fallback' && (
        <span className="sr-only">
          Vehículo 2D activo como modo de compatibilidad.
        </span>
      )}

      {status === 'ready' && <TouchControls input={inputController} />}

      {(status === 'error' || status === 'unsupported') && (
        <div className="map-message map-message--error" role="alert">
          <strong>
            {status === 'unsupported'
              ? 'WebGL no está disponible'
              : 'No pudimos cargar el mapa'}
          </strong>
          <p>
            {status === 'unsupported'
              ? 'Activa la aceleración gráfica o utiliza un navegador compatible.'
              : 'Vuelve a intentarlo. Tu progreso no se perdió.'}
          </p>
          {status === 'error' && (
            <details className="map-message__details">
              <summary>Ver detalles técnicos</summary>
              <code>{errorMessage}</code>
            </details>
          )}
          <div className="map-message__actions">
            {status === 'error' && (
              <button type="button" onClick={retryMap}>
                Reintentar
              </button>
            )}
            <button type="button" onClick={onExitToTitle}>
              Volver al inicio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

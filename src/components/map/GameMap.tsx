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
import { movementSubstepConfig } from '../../config/movementSubstep.config';
import {
  roadAssistConfig,
  savedRoadPositionConfig,
} from '../../config/roadHandling.config';
import { autoThrottleConfig } from '../../config/mobileControls.config';
import { vehicleStateConfig } from '../../config/vehicleState.config';
import { missionById } from '../../data/missions';
import { restrictedAreaTypeAt } from '../../data/restrictedAreas';
import {
  vehicleDefinitionFor,
  vehicleRuntimeFor,
  vehicleSkinFor,
} from '../../data/vehicles';
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
import { runtimeGateFor } from '../../game/runtimeGate';
import {
  advanceRoadAssistActiveElapsedMilliseconds,
  roadAssistMultiplierForLatePromotion,
} from '../../game/roadPromotion';
import {
  AdaptiveCameraCadenceController,
  cameraCadenceDeadlineAfterApplication,
  cameraCadenceShouldApply,
  type CameraCadenceHertz,
} from '../../game/adaptiveCameraCadence';
import {
  followCameraOffsetForSafeViewport,
  safeGameplayViewportFor,
  type GameplayOcclusion,
  type GameplayOcclusionKind,
  type GameplayRect,
  type SafeGameplayViewport,
} from '../../game/safeGameplayViewport';
import {
  safeViewportMutationRootFor,
  safeViewportOccluderObserverOptions,
  safeViewportTreeObserverOptions,
} from '../../game/safeViewportObservers';
import {
  effectiveDrivingSurfaceLabel,
  type DrivingPresentationMode,
} from '../../game/drivingPresentation';
import { startPlayerGameLoop, type PlayerGameLoop } from '../../game/gameLoop';
import {
  distanceBetweenMeters,
  findDiscoverableLocations,
  findNearestLocation,
} from '../../game/discovery';
import {
  isInsideValidObjectiveZone,
  nearestPendingObjective,
  objectiveCoordinates,
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
import {
  applyPlayerMarkerSkin,
  createPlayerMarkerElement,
} from '../../map/playerMarker';
import { PlayerVisualUpdateCoordinator } from '../../map/playerVisualUpdates';
import {
  registerPmtilesProtocol,
  subscribePmtilesProtocolFailures,
} from '../../map/pmtilesProtocol';
import { addRoadDebugLayer } from '../../map/roadDebugLayer';
import { addPlayableRoadSurfaceLayer } from '../../map/roadSurfaceLayer';
import { createConfiguredStyleResourceTransform } from '../../map/styleResources';
import {
  createMapDeclutterController,
  type MapDeclutterController,
} from '../../map/mapDeclutter';
import type { ThreeGameLayerController } from '../../map/threeLayer';
import { shouldUseThreePlayer } from '../../map/threeTransforms';
import { loadRoadNetwork } from '../../roads/roadNetwork';
import {
  clearRouteRejoinRoadSource,
  setRouteRejoinRoadSource,
} from '../../roads/routeRejoinRoadSource';
import {
  allowRoadlessStartup,
  isRoadlessStartupAllowed,
  ROAD_NETWORK_STARTUP_DEADLINE_MILLISECONDS,
} from '../../roads/roadStartup';
import { RoadTracker } from '../../roads/roadTracker';
import type { RoadSpatialIndex } from '../../roads/spatialIndex';
import { alignedRoadHeading } from '../../roads/initialRoadPosition';
import {
  INITIAL_PLAYER,
  useGameStore,
  type DrivingWearSample,
} from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { PlayerRuntime, PlayerTelemetry } from '../../types/game';
import type { RoadContact, RoadEdge } from '../../types/roads';

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

const SAFE_VIEWPORT_OCCLUDERS: readonly {
  selector: string;
  kind: GameplayOcclusionKind;
}[] = [
  { selector: '.topbar', kind: 'hud' },
  { selector: '.mobile-driving-hud', kind: 'hud' },
  { selector: '.virtual-joystick__base', kind: 'joystick' },
  { selector: '.touch-actions', kind: 'actions' },
  { selector: '.mobile-cruise-target', kind: 'target-speed' },
  { selector: '[data-testid="mobile-mini-navigator"]', kind: 'navigator' },
  { selector: '.radio-message--compact', kind: 'radio' },
  { selector: '.stuck-vehicle-assist', kind: 'overlay' },
  { selector: '.mobile-tutorial-card', kind: 'overlay' },
  { selector: '.tutorial-coach', kind: 'overlay' },
  { selector: '.contextual-advice', kind: 'overlay' },
  { selector: '.discovery-toast--compact', kind: 'overlay' },
  { selector: '.service-worker-update', kind: 'overlay' },
  { selector: '.install-hint', kind: 'overlay' },
  { selector: '.narrative-dialog', kind: 'overlay' },
  { selector: '.pause-menu', kind: 'overlay' },
] as const;

function elementContainsSafeViewportOccluder(element: Element): boolean {
  return SAFE_VIEWPORT_OCCLUDERS.some(
    ({ selector }) =>
      element.matches(selector) || element.querySelector(selector) !== null,
  );
}

function mutationAffectsSafeViewport(record: MutationRecord): boolean {
  if (record.type === 'attributes') {
    return (
      record.target instanceof Element &&
      elementContainsSafeViewportOccluder(record.target)
    );
  }
  return [...record.addedNodes, ...record.removedNodes].some(
    (node) =>
      node instanceof Element && elementContainsSafeViewportOccluder(node),
  );
}

function gameplayRectFromDomRect(rect: DOMRectReadOnly): GameplayRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
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
    containerRef.current.dataset.followingPlayer = String(
      useGameStore.getState().isFollowingPlayer,
    );
    let activeVehicleDefinition = vehicleDefinitionFor(
      useGameStore.getState().selectedVehicleId,
    );
    let activeVehicleSkin = vehicleSkinFor(
      activeVehicleDefinition.id,
      useGameStore.getState().selectedVehicleSkinId,
    );
    let activeVehicleRuntime = vehicleRuntimeFor(activeVehicleDefinition.id);
    containerRef.current.dataset.selectedVehicleId = activeVehicleDefinition.id;
    containerRef.current.dataset.selectedVehicleSkinId = activeVehicleSkin.id;

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
    let nextCameraUpdateDeadline = 0;
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
    let cameraSafeProjectionUpdates = 0;
    const initialCameraCadenceHertz: CameraCadenceHertz =
      deviceProfile.cameraUpdateIntervalMilliseconds >= 45 ? 20 : 30;
    const maximumCameraCadenceHertz: CameraCadenceHertz =
      deviceProfile.quality === 'low'
        ? 30
        : deviceProfile.quality === 'medium'
          ? 45
          : 60;
    const adaptiveCameraCadence = new AdaptiveCameraCadenceController({
      initialHertz: initialCameraCadenceHertz,
      maximumHertz: maximumCameraCadenceHertz,
    });
    containerRef.current.dataset.cameraCadenceHertz = String(
      adaptiveCameraCadence.state.hertz,
    );
    containerRef.current.dataset.cameraCadenceMaximumHertz = String(
      maximumCameraCadenceHertz,
    );
    const activeCameraUpdateIntervalMilliseconds = () =>
      deviceProfile.isTouch
        ? adaptiveCameraCadence.intervalMilliseconds
        : deviceProfile.cameraUpdateIntervalMilliseconds;
    const resetCameraUpdateDeadline = (timestampMilliseconds: number) => {
      nextCameraUpdateDeadline =
        timestampMilliseconds + activeCameraUpdateIntervalMilliseconds();
    };
    const initialCanvasWidth = Math.max(
      1,
      map.getCanvas().clientWidth || window.innerWidth,
    );
    const initialCanvasHeight = Math.max(
      1,
      map.getCanvas().clientHeight || window.innerHeight,
    );
    let safeCanvasRect: GameplayRect = {
      x: 0,
      y: 0,
      width: initialCanvasWidth,
      height: initialCanvasHeight,
    };
    let safeGameplayViewport: SafeGameplayViewport = safeGameplayViewportFor({
      canvas: safeCanvasRect,
      visibleViewport: safeCanvasRect,
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      playerFootprint: { width: 48, height: 60 },
      occlusions: [],
    });
    let lastValidSafeGameplayViewport = safeGameplayViewport;
    let safeViewportObstructed = false;
    let safeViewportMeasurementFrame: number | null = null;
    let safeViewportResizeObserver: ResizeObserver | null = null;
    let safeViewportMutationObserver: MutationObserver | null = null;
    let safeViewportOccluderMutationObserver: MutationObserver | null = null;
    let safeViewportMeasurementCount = 0;
    let safeViewportRevision = 0;
    let lastExposedSafeViewportRevision = -1;
    const safeViewportObservedElements = new Set<Element>();
    let recoveryCameraUntil = 0;
    let effectActive = true;
    let roadTracker: RoadTracker | null = null;
    let roadIndex: RoadSpatialIndex | null = null;
    let roadEdgesById: ReadonlyMap<number, RoadEdge> = new Map();
    let roadContact: RoadContact | null = null;
    let activeRouteEdgeIds = new Set(
      useGameStore.getState().missionRoute.activeEdgeIds,
    );
    let roadNetworkEnabled = false;
    let lateRoadPromotionAssistElapsedMilliseconds: number | null = null;
    let lateRoadPromotionAssistLastActiveTimestamp: number | null = null;
    let lateRoadPromotionAssistFirstActiveSamplePending = false;
    let lateRoadPromotionAssistResumeSamplePending = false;
    let roadNetworkStartupDeadline: number | null = null;
    let lastBlockedImpactTimestamp = Number.NEGATIVE_INFINITY;
    let visualFrameCount = 0;
    let lastExposedInputLatencySequence = 0;
    let lastFrameSampleTimestamp = performance.now();
    let previousHapticSurface = useGameStore.getState().driving.surface;
    let interactionWasActive = false;
    let startupReady = false;
    let fatalMapErrorHandled = false;
    let lastRuntimeGateKey = -1;
    let runtimeSimulationEnabled = false;

    const validateInitialRoadPosition = (player: PlayerRuntime): boolean => {
      if (!roadIndex || !useGameStore.getState().needsInitialRoadAlignment) {
        return false;
      }
      const state = useGameStore.getState();
      const currentPosition: [number, number] = [
        player.longitude,
        player.latitude,
      ];
      const activeMission = state.activeMissionId
        ? missionById.get(state.activeMissionId)
        : null;
      const nearbyObjective = activeMission
        ? nearestPendingObjective(
            activeMission,
            state.activeMissionCompletedObjectiveIds,
            currentPosition,
          )
        : null;
      const nearbyObjectiveCoordinates = nearbyObjective
        ? objectiveCoordinates(nearbyObjective.objective)
        : null;
      if (
        state.hasSavedGame &&
        nearbyObjective &&
        nearbyObjectiveCoordinates &&
        distanceBetweenMeters(currentPosition, nearbyObjectiveCoordinates) <=
          nearbyObjective.objective.radiusMeters
      ) {
        return useGameStore
          .getState()
          .alignInitialPlayerToRoad(currentPosition, player.heading, 0);
      }
      if (!state.hasSavedGame && roadTracker) {
        const contact = roadTracker.update(
          currentPosition,
          roadContextFor(player),
        );
        if (
          !contact ||
          contact.nearest.distanceMeters >
            roadAssistConfig.disengageDistanceMeters
        ) {
          return false;
        }
        return useGameStore
          .getState()
          .alignInitialPlayerToRoad(
            contact.nearest.coordinates,
            alignedRoadHeading(
              player.heading,
              contact.nearest.heading,
              contact.edge.oneWay,
            ),
            contact.nearest.distanceMeters,
          );
      }
      let sourceHeading = player.heading;
      let nearest = roadIndex.findNearestRoad(
        currentPosition,
        savedRoadPositionConfig.validationRadiusMeters,
      );
      let distanceFromPlayer = nearest?.distanceMeters;

      if (!nearest) {
        const recoveryPlayer = state.lastSafeCheckpoint.player;
        sourceHeading = recoveryPlayer.heading;
        nearest = roadIndex.findNearestRoad(
          [recoveryPlayer.longitude, recoveryPlayer.latitude],
          savedRoadPositionConfig.validationRadiusMeters,
        );
        distanceFromPlayer = Number.POSITIVE_INFINITY;
      }
      if (!nearest) {
        sourceHeading = INITIAL_PLAYER.heading;
        nearest = roadIndex.findNearestRoad(
          [INITIAL_PLAYER.longitude, INITIAL_PLAYER.latitude],
          savedRoadPositionConfig.validationRadiusMeters,
        );
        distanceFromPlayer = Number.POSITIVE_INFINITY;
      }
      if (!nearest) return false;

      const edge = roadEdgesById.get(nearest.edgeId);
      if (!edge) return false;
      return useGameStore
        .getState()
        .alignInitialPlayerToRoad(
          nearest.coordinates,
          alignedRoadHeading(sourceHeading, nearest.heading, edge.oneWay),
          distanceFromPlayer ?? Number.POSITIVE_INFINITY,
        );
    };

    const recordMapErrorClassification = (
      classification: MapRuntimeErrorClassification,
    ) => {
      const container = containerRef.current;
      if (!container) return;
      if (fatalMapErrorHandled && classification.severity !== 'fatal') {
        container.dataset.mapLastNonfatalError = classification.details;
        return;
      }
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
      const profileOverride = deviceProfile.isTouch
        ? timestampMilliseconds < recoveryCameraUntil
          ? 'recovery'
          : presentationMode === 'interaction' && speedKilometersPerHour <= 10
            ? 'interaction'
            : null
        : null;
      const profile = drivingCameraProfile(
        cameraMode,
        deviceProfile.isTouch,
        undefined,
        profileOverride,
      );
      const camera = followCameraTarget(
        cameraMode,
        deviceProfile.isTouch,
        profileOverride,
      );
      const canvas = map.getCanvas();
      return {
        options: {
          center: [player.longitude, player.latitude] as [number, number],
          bearing: player.heading,
          zoom: Math.min(camera.zoom, mapSourceConfig.maxZoom),
          pitch: Math.min(camera.pitch, deviceProfile.maximumInitialPitch),
          offset: deviceProfile.isTouch
            ? followCameraOffsetForSafeViewport(
                safeCanvasRect,
                safeGameplayViewport,
                profile.safeAnchorYRatio,
              )
            : followCameraOffset(
                canvas.clientWidth,
                canvas.clientHeight,
                profile.offsetYRatio,
              ),
        },
        profile,
        profileName: deviceProfile.isTouch
          ? profileOverride === 'recovery'
            ? 'mobileRecovery'
            : profileOverride === 'interaction'
              ? 'mobileInteraction'
              : cameraMode === 'fast'
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
    const exposeAppliedProjection = (center: [number, number]) => {
      const container = containerRef.current;
      if (!container) return;
      const canvas = map.getCanvas();
      const projected = map.project(center);
      container.dataset.cameraAppliedScreenOffsetX = (
        projected.x -
        canvas.clientWidth / 2
      ).toFixed(1);
      container.dataset.cameraAppliedScreenOffsetY = (
        projected.y -
        canvas.clientHeight / 2
      ).toFixed(1);
      const playerX = safeCanvasRect.x + projected.x;
      const playerY = safeCanvasRect.y + projected.y;
      const playerHalfWidth = 24;
      const playerHalfHeight = 30;
      const safeRight = safeGameplayViewport.x + safeGameplayViewport.width;
      const safeBottom = safeGameplayViewport.y + safeGameplayViewport.height;
      container.dataset.safePlayerYRatio = (
        (playerY - safeGameplayViewport.y) /
        Math.max(1, safeGameplayViewport.height)
      ).toFixed(3);
      container.dataset.playerOutsideSafeViewport = String(
        playerX - playerHalfWidth < safeGameplayViewport.x ||
          playerX + playerHalfWidth > safeRight ||
          playerY - playerHalfHeight < safeGameplayViewport.y ||
          playerY + playerHalfHeight > safeBottom,
      );
      cameraSafeProjectionUpdates += 1;
      container.dataset.cameraSafeProjectionUpdates = String(
        cameraSafeProjectionUpdates,
      );
      lastExposedSafeViewportRevision = safeViewportRevision;
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
      if (!update.mapOptions || !update.appliedOptions) {
        if (
          lastAppliedCameraOptions &&
          lastExposedSafeViewportRevision !== safeViewportRevision
        ) {
          exposeAppliedProjection(lastAppliedCameraOptions.center);
        }
        return update;
      }

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
      const projectionChanged =
        lastExposedSafeViewportRevision !== safeViewportRevision ||
        update.changes.offset ||
        update.changes.zoom ||
        update.changes.pitch;
      if (projectionChanged) {
        if (durationMilliseconds > 0) {
          void map.once('moveend', () =>
            exposeAppliedProjection(update.appliedOptions!.center),
          );
        } else {
          exposeAppliedProjection(update.appliedOptions.center);
        }
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
    const safeAreaProbe = document.createElement('div');
    safeAreaProbe.setAttribute('aria-hidden', 'true');
    safeAreaProbe.style.cssText = [
      'position:fixed',
      'inset:0 auto auto 0',
      'width:0',
      'height:0',
      'padding-top:env(safe-area-inset-top)',
      'padding-right:env(safe-area-inset-right)',
      'padding-bottom:env(safe-area-inset-bottom)',
      'padding-left:env(safe-area-inset-left)',
      'visibility:hidden',
      'pointer-events:none',
    ].join(';');
    document.body.append(safeAreaProbe);

    const safeViewportOcclusions = (): {
      elements: HTMLElement[];
      occlusions: GameplayOcclusion[];
    } => {
      const elements: HTMLElement[] = [];
      const occlusions: GameplayOcclusion[] = [];
      for (const { selector, kind } of SAFE_VIEWPORT_OCCLUDERS) {
        document
          .querySelectorAll<HTMLElement>(selector)
          .forEach((element, index) => {
            elements.push(element);
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            if (
              rect.width <= 0 ||
              rect.height <= 0 ||
              style.display === 'none' ||
              style.visibility === 'hidden'
            ) {
              return;
            }
            occlusions.push({
              id: `${selector}:${String(index)}`,
              kind,
              rect: gameplayRectFromDomRect(rect),
            });
          });
      }
      return { elements, occlusions };
    };

    const measureSafeGameplayViewport = (): boolean => {
      const canvasRect = gameplayRectFromDomRect(
        map.getCanvas().getBoundingClientRect(),
      );
      if (canvasRect.width <= 0 || canvasRect.height <= 0) return false;
      safeViewportMeasurementCount += 1;
      const viewport = window.visualViewport;
      const visibleViewport: GameplayRect = viewport
        ? {
            x: viewport.offsetLeft,
            y: viewport.offsetTop,
            width: viewport.width,
            height: viewport.height,
          }
        : {
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };
      const probeStyle = window.getComputedStyle(safeAreaProbe);
      const { elements, occlusions } = safeViewportOcclusions();
      const measured = safeGameplayViewportFor({
        canvas: canvasRect,
        visibleViewport,
        safeAreaInsets: {
          top: Number.parseFloat(probeStyle.paddingTop) || 0,
          right: Number.parseFloat(probeStyle.paddingRight) || 0,
          bottom: Number.parseFloat(probeStyle.paddingBottom) || 0,
          left: Number.parseFloat(probeStyle.paddingLeft) || 0,
        },
        playerFootprint: { width: 48, height: 60 },
        occlusions,
      });
      const previousCanvas = safeCanvasRect;
      const previousSafe = safeGameplayViewport;
      const previousObstructed = safeViewportObstructed;
      safeCanvasRect = canvasRect;
      safeViewportObstructed = measured.obstructed;
      if (!measured.obstructed) {
        lastValidSafeGameplayViewport = measured;
      }
      safeGameplayViewport = measured.obstructed
        ? lastValidSafeGameplayViewport
        : measured;

      const nextObservedElements = new Set<Element>([
        map.getCanvas(),
        ...elements,
      ]);
      for (const element of safeViewportObservedElements) {
        if (!nextObservedElements.has(element)) {
          safeViewportResizeObserver?.unobserve(element);
          safeViewportObservedElements.delete(element);
        }
      }
      for (const element of nextObservedElements) {
        if (!safeViewportObservedElements.has(element)) {
          safeViewportResizeObserver?.observe(element);
          safeViewportObservedElements.add(element);
        }
      }
      safeViewportOccluderMutationObserver?.disconnect();
      for (const element of elements) {
        safeViewportOccluderMutationObserver?.observe(
          element,
          safeViewportOccluderObserverOptions,
        );
      }

      const container = containerRef.current;
      if (container) {
        container.dataset.safeViewportX = safeGameplayViewport.x.toFixed(1);
        container.dataset.safeViewportY = safeGameplayViewport.y.toFixed(1);
        container.dataset.safeViewportWidth =
          safeGameplayViewport.width.toFixed(1);
        container.dataset.safeViewportHeight =
          safeGameplayViewport.height.toFixed(1);
        container.dataset.usefulMapAreaRatio =
          measured.usefulMapAreaRatio.toFixed(3);
        container.dataset.safeViewportOcclusionCount = String(
          occlusions.length,
        );
        container.dataset.safeViewportMeasurementCount = String(
          safeViewportMeasurementCount,
        );
        container.dataset.safeViewportObstructed = String(measured.obstructed);
        container.dataset.safeViewportMode = window.matchMedia(
          '(display-mode: standalone)',
        ).matches
          ? 'pwa'
          : 'browser';
      }

      const changed =
        Math.abs(previousCanvas.x - safeCanvasRect.x) >= 0.5 ||
        Math.abs(previousCanvas.y - safeCanvasRect.y) >= 0.5 ||
        Math.abs(previousCanvas.width - safeCanvasRect.width) >= 0.5 ||
        Math.abs(previousCanvas.height - safeCanvasRect.height) >= 0.5 ||
        Math.abs(previousSafe.x - safeGameplayViewport.x) >= 0.5 ||
        Math.abs(previousSafe.y - safeGameplayViewport.y) >= 0.5 ||
        Math.abs(previousSafe.width - safeGameplayViewport.width) >= 0.5 ||
        Math.abs(previousSafe.height - safeGameplayViewport.height) >= 0.5 ||
        previousObstructed !== safeViewportObstructed;
      if (changed) safeViewportRevision += 1;
      return changed;
    };

    const updateCameraForSafeViewport = () => {
      safeViewportMeasurementFrame = null;
      const changed = measureSafeGameplayViewport();
      if (!changed || !deviceProfile.isTouch) return;
      const player = gameLoop?.getPlayer();
      if (!player || !useGameStore.getState().isFollowingPlayer) return;
      const timestamp = performance.now();
      const update = applyFollowCamera(cameraForPlayer(player, timestamp));
      if (update.mapOptions) resetCameraUpdateDeadline(timestamp);
    };
    const scheduleSafeViewportMeasurement = () => {
      if (safeViewportMeasurementFrame !== null) return;
      safeViewportMeasurementFrame = window.requestAnimationFrame(
        updateCameraForSafeViewport,
      );
    };

    if ('ResizeObserver' in window) {
      safeViewportResizeObserver = new ResizeObserver(
        scheduleSafeViewportMeasurement,
      );
    }
    if ('MutationObserver' in window) {
      safeViewportOccluderMutationObserver = new MutationObserver(
        scheduleSafeViewportMeasurement,
      );
      safeViewportMutationObserver = new MutationObserver((records) => {
        if (records.some(mutationAffectsSafeViewport)) {
          scheduleSafeViewportMeasurement();
        }
      });
      safeViewportMutationObserver.observe(
        safeViewportMutationRootFor(containerRef.current),
        safeViewportTreeObserverOptions,
      );
    }
    window.visualViewport?.addEventListener(
      'resize',
      scheduleSafeViewportMeasurement,
    );
    window.visualViewport?.addEventListener(
      'scroll',
      scheduleSafeViewportMeasurement,
    );
    window.addEventListener('resize', scheduleSafeViewportMeasurement);
    window.addEventListener(
      'orientationchange',
      scheduleSafeViewportMeasurement,
    );
    scheduleSafeViewportMeasurement();

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
      if (document.visibilityState === 'hidden') {
        clearInterruptedInput();
        lateRoadPromotionAssistLastActiveTimestamp = null;
      }
      adaptiveCameraCadence.resetSampling(performance.now());
      resetCameraUpdateDeadline(performance.now());
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
      const initialRoadLoadDistanceMeters =
        useGameStore.getState().telemetry.totalDistanceMeters;
      useGameStore.getState().setRoadNetworkStatus('loading');
      if (containerRef.current) {
        containerRef.current.dataset.roadNetworkStatus = 'loading';
      }
      let roadNetworkSettled = false;
      let roadlessStartupFinished = false;
      const finishRoadlessStartup = (reason: 'shared-fallback' | 'timeout') => {
        if (!effectActive || roadNetworkSettled || roadlessStartupFinished)
          return;
        roadlessStartupFinished = true;
        roadNetworkEnabled = false;
        useGameStore.getState().setRoadNetworkStatus('unavailable');
        if (containerRef.current) {
          containerRef.current.dataset.roadNetworkStatus = 'unavailable';
          containerRef.current.dataset.roadNetworkFallbackReason = reason;
        }
        finishStartup();
      };
      if (isRoadlessStartupAllowed()) {
        finishRoadlessStartup('shared-fallback');
      }
      if (!roadlessStartupFinished) {
        roadNetworkStartupDeadline = window.setTimeout(() => {
          allowRoadlessStartup();
          finishRoadlessStartup('timeout');
        }, ROAD_NETWORK_STARTUP_DEADLINE_MILLISECONDS);
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
            if (!effectActive || roadNetworkSettled) return;
            roadNetworkSettled = true;
            if (roadNetworkStartupDeadline !== null) {
              window.clearTimeout(roadNetworkStartupDeadline);
              roadNetworkStartupDeadline = null;
            }
            removeRoadSurfaceLayer = addPlayableRoadSurfaceLayer(map, network);
            roadIndex = index;
            roadEdgesById = new Map(
              network.edges.map((edge) => [edge.id, edge]),
            );
            setRouteRejoinRoadSource({ index, edgesById: roadEdgesById });
            roadTracker = new RoadTracker(index);
            const currentPlayer =
              gameLoop?.getPlayer() ??
              runtimeFromTelemetry(useGameStore.getState().telemetry);
            const currentState = useGameStore.getState();
            const alignmentRevisionBefore = currentState.playerRuntimeRevision;
            const inputTargetBeforePromotion =
              inputController.getDiagnostics().mobileCruise
                .targetSpeedKilometersPerHour;
            const movedDuringRoadlessStartup =
              roadlessStartupFinished &&
              (Math.abs(
                currentState.telemetry.totalDistanceMeters -
                  initialRoadLoadDistanceMeters,
              ) >= 0.25 ||
                distanceBetweenMeters(
                  [currentPlayer.longitude, currentPlayer.latitude],
                  [initialPlayer.longitude, initialPlayer.latitude],
                ) >= 1 ||
                Math.abs(currentPlayer.speedMetersPerSecond) >= 0.25);
            let alignmentOutcome = 'validated';
            if (movedDuringRoadlessStartup) {
              currentState.acceptCurrentPlayerRoadPosition();
              alignmentOutcome = 'preserved-runtime';
              lateRoadPromotionAssistElapsedMilliseconds = 0;
              lateRoadPromotionAssistLastActiveTimestamp = null;
              lateRoadPromotionAssistFirstActiveSamplePending = true;
            } else if (!validateInitialRoadPosition(currentPlayer)) {
              currentState.acceptCurrentPlayerRoadPosition();
              alignmentOutcome = 'accepted-current';
            }
            const validatedPlayer =
              gameLoop?.getPlayer() ??
              runtimeFromTelemetry(useGameStore.getState().telemetry);
            const promotionRuntimeDisplacementMeters = distanceBetweenMeters(
              [currentPlayer.longitude, currentPlayer.latitude],
              [validatedPlayer.longitude, validatedPlayer.latitude],
            );
            const promotionRuntimeHeadingDelta = Math.abs(
              ((validatedPlayer.heading - currentPlayer.heading + 540) % 360) -
                180,
            );
            const promotionRuntimeSpeedDeltaKilometersPerHour =
              Math.abs(
                validatedPlayer.speedMetersPerSecond -
                  currentPlayer.speedMetersPerSecond,
              ) * 3.6;
            const promotionInputTargetDeltaKilometersPerHour = Math.abs(
              inputController.getDiagnostics().mobileCruise
                .targetSpeedKilometersPerHour - inputTargetBeforePromotion,
            );
            roadContact = roadTracker.update(
              [validatedPlayer.longitude, validatedPlayer.latitude],
              roadContextFor(validatedPlayer),
            );
            roadNetworkEnabled = true;
            useGameStore.getState().setRoadNetworkStatus('ready');
            useGameStore.getState().requestMissionRouteRecalculation();
            if (containerRef.current) {
              containerRef.current.dataset.roadNetworkStatus = 'ready';
              containerRef.current.dataset.roadNetworkPromotedFromFallback =
                String(roadlessStartupFinished);
              containerRef.current.dataset.initialRoadAlignmentOutcome =
                alignmentOutcome;
              containerRef.current.dataset.initialRoadAlignmentRevisionDelta =
                String(
                  useGameStore.getState().playerRuntimeRevision -
                    alignmentRevisionBefore,
                );
              containerRef.current.dataset.roadPromotionAssistRamp =
                movedDuringRoadlessStartup ? 'active' : 'not-needed';
              containerRef.current.dataset.roadPromotionAssistPausedElapsedMs =
                '';
              containerRef.current.dataset.roadPromotionAssistResumedElapsedMs =
                '';
              containerRef.current.dataset.roadPromotionAssistResumedRamp = '';
              containerRef.current.dataset.roadPromotionRuntimeDisplacementMeters =
                promotionRuntimeDisplacementMeters.toFixed(3);
              containerRef.current.dataset.roadPromotionRuntimeHeadingDelta =
                promotionRuntimeHeadingDelta.toFixed(3);
              containerRef.current.dataset.roadPromotionRuntimeSpeedDeltaKph =
                promotionRuntimeSpeedDeltaKilometersPerHour.toFixed(3);
              containerRef.current.dataset.roadPromotionInputTargetDeltaKph =
                promotionInputTargetDeltaKilometersPerHour.toFixed(3);
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
          if (!effectActive || roadNetworkSettled) return;
          roadNetworkSettled = true;
          if (roadNetworkStartupDeadline !== null) {
            window.clearTimeout(roadNetworkStartupDeadline);
            roadNetworkStartupDeadline = null;
          }
          roadNetworkEnabled = false;
          useGameStore.getState().setRoadNetworkStatus('unavailable');
          if (roadlessStartupFinished) return;
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
        element: createPlayerMarkerElement(activeVehicleSkin),
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
                playerModelUrl: activeVehicleDefinition.modelUrl,
                playerModelScale: activeVehicleDefinition.modelScale,
                vehicleBodyColor: activeVehicleSkin.bodyColor,
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
      resetCameraUpdateDeadline(initialCameraTimestamp);
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
          const runtimeGateKey =
            Number(startupReady) |
            (Number(fatalMapErrorHandled) << 1) |
            (Number(state.isPaused) << 2) |
            (Number(state.isJournalOpen) << 3) |
            (Number(state.activeNarrativeEventId !== null) << 4) |
            (Number(state.activeMissionChoiceObjectiveId !== null) << 5) |
            (Number(state.recoveryReason !== null) << 6) |
            (Number(state.vehicle.condition > 0) << 7);
          if (runtimeGateKey !== lastRuntimeGateKey) {
            lastRuntimeGateKey = runtimeGateKey;
            const gate = runtimeGateFor({
              startupReady,
              fatalMapError: fatalMapErrorHandled,
              paused: state.isPaused,
              journalOpen: state.isJournalOpen,
              narrativeActive: state.activeNarrativeEventId !== null,
              missionChoiceActive:
                state.activeMissionChoiceObjectiveId !== null,
              recoveryActive: state.recoveryReason !== null,
              vehicleEnabled: state.vehicle.condition > 0,
            });
            const simulationWasEnabled = runtimeSimulationEnabled;
            runtimeSimulationEnabled = gate.simulationEnabled;
            if (
              !runtimeSimulationEnabled &&
              lateRoadPromotionAssistElapsedMilliseconds !== null
            ) {
              lateRoadPromotionAssistLastActiveTimestamp = null;
              if (simulationWasEnabled) {
                lateRoadPromotionAssistResumeSamplePending = true;
                if (containerRef.current) {
                  containerRef.current.dataset.roadPromotionAssistPausedElapsedMs =
                    lateRoadPromotionAssistElapsedMilliseconds.toFixed(3);
                  containerRef.current.dataset.roadPromotionAssistResumedElapsedMs =
                    '';
                }
              }
            }
            if (containerRef.current) {
              containerRef.current.dataset.driveEnabled = String(
                gate.drivingInputEnabled,
              );
              containerRef.current.dataset.runtimeBlockedBy =
                gate.blockedBy ?? '';
            }
          }
          return !runtimeSimulationEnabled;
        },
        getMovementOptions: () => {
          const roadContactTimestamp = performance.now();
          let latePromotionAssistMultiplier = 1;
          if (lateRoadPromotionAssistElapsedMilliseconds !== null) {
            lateRoadPromotionAssistElapsedMilliseconds =
              advanceRoadAssistActiveElapsedMilliseconds(
                lateRoadPromotionAssistElapsedMilliseconds,
                lateRoadPromotionAssistLastActiveTimestamp,
                roadContactTimestamp,
                movementSubstepConfig.maximumDeltaTimeSeconds * 1_000,
              );
            lateRoadPromotionAssistLastActiveTimestamp = roadContactTimestamp;
            latePromotionAssistMultiplier =
              roadAssistMultiplierForLatePromotion(
                0,
                lateRoadPromotionAssistElapsedMilliseconds,
              );
            if (lateRoadPromotionAssistResumeSamplePending) {
              lateRoadPromotionAssistResumeSamplePending = false;
              if (containerRef.current) {
                containerRef.current.dataset.roadPromotionAssistResumedElapsedMs =
                  lateRoadPromotionAssistElapsedMilliseconds.toFixed(3);
                containerRef.current.dataset.roadPromotionAssistResumedRamp =
                  latePromotionAssistMultiplier < 1 ? 'active' : 'complete';
              }
            }
            if (lateRoadPromotionAssistFirstActiveSamplePending) {
              lateRoadPromotionAssistFirstActiveSamplePending = false;
              if (containerRef.current) {
                containerRef.current.dataset.roadPromotionFirstActiveAssistMultiplier =
                  latePromotionAssistMultiplier.toFixed(3);
              }
            }
          }
          if (
            lateRoadPromotionAssistElapsedMilliseconds !== null &&
            latePromotionAssistMultiplier >= 1
          ) {
            lateRoadPromotionAssistElapsedMilliseconds = null;
            lateRoadPromotionAssistLastActiveTimestamp = null;
            if (containerRef.current) {
              containerRef.current.dataset.roadPromotionAssistRamp = 'complete';
            }
          }
          return {
            travel: activeVehicleRuntime.travel,
            handling: activeVehicleRuntime.handling,
            fuel: activeVehicleRuntime.fuel,
            steeringSensitivity:
              useSettingsStore.getState().steeringSensitivity,
            roadAssistMode: useSettingsStore.getState().roadAssistMode,
            roadAssistStrengthMultiplier: deviceProfile.isTouch
              ? roadAssistConfig.mobileStrengthMultiplier *
                latePromotionAssistMultiplier
              : latePromotionAssistMultiplier,
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
          if (deviceProfile.isTouch) {
            const completedCameraWindow =
              adaptiveCameraCadence.recordVisualFrame(timestamp);
            if (completedCameraWindow && containerRef.current) {
              containerRef.current.dataset.cameraCadenceHertz = String(
                adaptiveCameraCadence.state.hertz,
              );
              containerRef.current.dataset.cameraCadenceFrametimeP95Ms =
                completedCameraWindow.frametimeP95Milliseconds.toFixed(2);
              containerRef.current.dataset.cameraCadenceFramesOver50 = String(
                completedCameraWindow.framesOver50Milliseconds,
              );
              containerRef.current.dataset.cameraCadenceFramesOver100 = String(
                completedCameraWindow.framesOver100Milliseconds,
              );
              if (
                Number.isFinite(completedCameraWindow.cameraP95Milliseconds)
              ) {
                containerRef.current.dataset.cameraCadenceCameraP95Ms =
                  completedCameraWindow.cameraP95Milliseconds.toFixed(3);
              }
            }
          }
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
          if (playerVisualUpdates) {
            playerVisualUpdates.update(
              player,
              gameLoop?.getSurface() === 'offroad',
            );
            inputController.markInputVisualFrame(timestamp);
          }

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
            const cameraUpdateIntervalMilliseconds =
              activeCameraUpdateIntervalMilliseconds();
            if (
              !cameraCadenceShouldApply(timestamp, nextCameraUpdateDeadline)
            ) {
              cameraSkippedByInterval += 1;
              exposeCameraMetrics(timestamp);
              wasFollowing = true;
              return;
            }
            nextCameraUpdateDeadline = cameraCadenceDeadlineAfterApplication(
              nextCameraUpdateDeadline,
              timestamp,
              cameraUpdateIntervalMilliseconds,
            );
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
              exposeCameraMetrics(timestamp);
              wasFollowing = true;
              return;
            }
            recenterUntil = isRecentering ? timestamp + duration : 0;
            lastFollowedLongitude = player.longitude;
            lastFollowedLatitude = player.latitude;
            lastFollowedHeading = player.heading;
            lastFollowedSpeedKilometersPerHour = speedKilometersPerHour;
            const cameraUpdateDuration = performance.now() - cameraStartedAt;
            if (deviceProfile.isTouch) {
              adaptiveCameraCadence.recordCameraUpdate(cameraUpdateDuration);
            }
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
            const inputLatency = inputController.getInputLatencyDiagnostics();
            if (
              inputLatency.sequence !== lastExposedInputLatencySequence &&
              inputLatency.inputToFirstVisualMilliseconds !== null
            ) {
              lastExposedInputLatencySequence = inputLatency.sequence;
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
              containerRef.current.dataset.inputFirstPositionLatencyMs =
                inputLatency.inputToFirstPositionMilliseconds?.toFixed(3) ?? '';
              containerRef.current.dataset.inputFirstVisualLatencyMs =
                inputLatency.inputToFirstVisualMilliseconds.toFixed(3);
              containerRef.current.dataset.inputConsumptionToPositionLatencyMs =
                inputLatency.consumptionToFirstPositionMilliseconds?.toFixed(
                  3,
                ) ?? '';
              containerRef.current.dataset.inputConsumptionToVisualLatencyMs =
                inputLatency.consumptionToFirstVisualMilliseconds?.toFixed(3) ??
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
            const wearSamples: DrivingWearSample[] = [];
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
              if (
                blockedImpact ||
                sample.environment.surface === 'offroad' ||
                sample.environment.surface === 'track' ||
                sample.environment.surface === 'dirt-road'
              ) {
                wearSamples.push({
                  vehicleDistanceMeters: sample.vehicleDistanceMeters,
                  surface: sample.environment.surface,
                  blockedImpact,
                });
              }
            }
            if (wearSamples.length > 0) {
              state.applyDrivingWearSamples(
                wearSamples,
                (selectedMissionChoiceOption(
                  state.activeMissionId,
                  state.missionChoiceSelections,
                )?.conditionMultiplier ?? 1) *
                  activeVehicleRuntime.conditionWearMultiplier,
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
        if (
          state.selectedVehicleId !== previousState.selectedVehicleId ||
          state.selectedVehicleSkinId !== previousState.selectedVehicleSkinId
        ) {
          activeVehicleDefinition = vehicleDefinitionFor(
            state.selectedVehicleId,
          );
          activeVehicleSkin = vehicleSkinFor(
            activeVehicleDefinition.id,
            state.selectedVehicleSkinId,
          );
          activeVehicleRuntime = vehicleRuntimeFor(activeVehicleDefinition.id);
          const markerElement = playerMarker?.getElement();
          if (markerElement)
            applyPlayerMarkerSkin(markerElement, activeVehicleSkin);
          threeLayer?.setVehicleSkin(
            activeVehicleSkin.bodyColor,
            activeVehicleDefinition.modelScale,
          );
          if (containerRef.current) {
            containerRef.current.dataset.selectedVehicleId =
              activeVehicleDefinition.id;
            containerRef.current.dataset.selectedVehicleSkinId =
              activeVehicleSkin.id;
          }
        }
        if (
          state.isFollowingPlayer !== previousState.isFollowingPlayer &&
          containerRef.current
        ) {
          containerRef.current.dataset.followingPlayer = String(
            state.isFollowingPlayer,
          );
        }
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
        if (state.needsInitialRoadAlignment && roadIndex) {
          const player = runtimeFromTelemetry(state.telemetry);
          const revisionBeforeAlignment = state.playerRuntimeRevision;
          if (validateInitialRoadPosition(player)) {
            if (
              useGameStore.getState().playerRuntimeRevision !==
              revisionBeforeAlignment
            ) {
              return;
            }
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
        if (state.lastCheckpoint.reason === 'rejoin') {
          recoveryCameraUntil = restoredCameraTimestamp + 1_200;
        }
        const restoredCamera = cameraForPlayer(
          restoredPlayer,
          restoredCameraTimestamp,
          true,
        );
        applyFollowCamera(restoredCamera, { force: true });
        resetCameraUpdateDeadline(restoredCameraTimestamp);
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
      if (deviceProfile.isTouch) {
        scheduleSafeViewportMeasurement();
        return;
      }
      const player = gameLoop?.getPlayer();
      if (!player || !useGameStore.getState().isFollowingPlayer) return;
      const camera = cameraForPlayer(player, performance.now());
      const cameraUpdate = applyFollowCamera(camera);
      if (!cameraUpdate.mapOptions) return;
      resetCameraUpdateDeadline(performance.now());
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
      transformStyle: createConfiguredStyleResourceTransform(
        window.location.href,
      ),
    });

    return () => {
      effectActive = false;
      window.cancelAnimationFrame(loadingFrame);
      if (safeViewportMeasurementFrame !== null) {
        window.cancelAnimationFrame(safeViewportMeasurementFrame);
      }
      safeViewportResizeObserver?.disconnect();
      safeViewportMutationObserver?.disconnect();
      safeViewportOccluderMutationObserver?.disconnect();
      window.visualViewport?.removeEventListener(
        'resize',
        scheduleSafeViewportMeasurement,
      );
      window.visualViewport?.removeEventListener(
        'scroll',
        scheduleSafeViewportMeasurement,
      );
      window.removeEventListener('resize', scheduleSafeViewportMeasurement);
      window.removeEventListener(
        'orientationchange',
        scheduleSafeViewportMeasurement,
      );
      safeAreaProbe.remove();
      if (roadNetworkStartupDeadline !== null) {
        window.clearTimeout(roadNetworkStartupDeadline);
      }
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
      if (roadIndex) clearRouteRejoinRoadSource(roadIndex);
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

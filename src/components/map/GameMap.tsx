import maplibregl, { type ErrorEvent } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TouchControls } from '../game/TouchControls';
import { gameConfig } from '../../config/game.config';
import { followCameraConfig } from '../../config/followCamera.config';
import { mapSourceConfig, mapViewConfig } from '../../config/map.config';
import { roadAssistConfig } from '../../config/roadHandling.config';
import { autoThrottleConfig } from '../../config/mobileControls.config';
import { vehicleStateConfig } from '../../config/vehicleState.config';
import { missionById } from '../../data/missions';
import { restrictedAreaTypeAt } from '../../data/restrictedAreas';
import { detectDeviceProfile } from '../../game/deviceProfile';
import {
  followCameraOffset,
  followCameraTarget,
} from '../../game/followCamera';
import { startPlayerGameLoop, type PlayerGameLoop } from '../../game/gameLoop';
import {
  findDiscoverableLocations,
  findNearestLocation,
} from '../../game/discovery';
import { nearestPendingObjective } from '../../game/missions';
import { InputController } from '../../game/inputController';
import { CLEAR_GAME_INPUT_EVENT } from '../../game/inputEvents';
import { triggerHaptic } from '../../game/haptics';
import { addLocationMarkers } from '../../map/locationMarkers';
import { addMissionRoute } from '../../map/missionRoute';
import { createPlayerMarkerElement } from '../../map/playerMarker';
import { registerPmtilesProtocol } from '../../map/pmtilesProtocol';
import { addRoadDebugLayer } from '../../map/roadDebugLayer';
import { createStyleResourceTransform } from '../../map/styleResources';
import type { ThreeGameLayerController } from '../../map/threeLayer';
import { shouldUseThreePlayer } from '../../map/threeTransforms';
import { loadRoadNetwork } from '../../roads/roadNetwork';
import { RoadTracker } from '../../roads/roadTracker';
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
  const coordinates = next?.coordinates;
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

export function GameMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported] = useState(supportsWebGl);
  const [inputController] = useState(() => new InputController());
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
    const map = new maplibregl.Map({
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

    let playerMarker: maplibregl.Marker | null = null;
    let threeLayer: ThreeGameLayerController | null = null;
    let gameLoop: PlayerGameLoop | null = null;
    let removeLocationMarkers: (() => void) | null = null;
    let removeMissionRoute: (() => void) | null = null;
    let removeRoadDebugLayer: (() => void) | null = null;
    let unsubscribeRuntime: (() => void) | null = null;
    let unsubscribeSettings: (() => void) | null = null;
    let lastCameraUpdate = 0;
    let lastFollowedLongitude = Number.NaN;
    let lastFollowedLatitude = Number.NaN;
    let lastFollowedHeading = Number.NaN;
    let lastFollowedSpeed = Number.NaN;
    let wasFollowing = false;
    let recenterUntil = 0;
    let effectActive = true;
    let roadTracker: RoadTracker | null = null;
    let roadContact: RoadContact | null = null;
    let roadNetworkEnabled = false;
    let lastBlockedImpactTimestamp = Number.NEGATIVE_INFINITY;
    let visualFrameCount = 0;
    let lastFrameSampleTimestamp = performance.now();
    let previousHapticSurface = useGameStore.getState().driving.surface;

    const cameraForPlayer = (player: PlayerRuntime) => {
      const camera = followCameraTarget(player.speedMetersPerSecond);
      const canvas = map.getCanvas();
      return {
        center: [player.longitude, player.latitude] as [number, number],
        bearing: player.heading,
        zoom: Math.min(camera.zoom, mapSourceConfig.maxZoom),
        pitch: Math.min(camera.pitch, deviceProfile.maximumInitialPitch),
        offset: followCameraOffset(canvas.clientWidth, canvas.clientHeight),
      };
    };
    const exposeCameraTarget = (camera: ReturnType<typeof cameraForPlayer>) => {
      const container = containerRef.current;
      if (!container) return;
      container.dataset.followZoom = camera.zoom.toFixed(2);
      container.dataset.followPitch = camera.pitch.toFixed(1);
      container.dataset.followOffsetY = String(camera.offset[1]);
    };
    const unbindKeyboard = inputController.bindKeyboard(
      window,
      useGameStore.getState().togglePaused,
      useGameStore.getState().requestMissionRouteRecalculation,
    );
    const clearInterruptedInput = () => inputController.clearAllInput();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') clearInterruptedInput();
    };
    window.addEventListener('blur', clearInterruptedInput);
    window.addEventListener('orientationchange', clearInterruptedInput);
    window.addEventListener(CLEAR_GAME_INPUT_EVENT, clearInterruptedInput);
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
      const initialPlayer = runtimeFromTelemetry(
        useGameStore.getState().telemetry,
      );
      useGameStore.getState().setRoadNetworkStatus('loading');
      if (containerRef.current) {
        containerRef.current.dataset.roadNetworkStatus = 'loading';
      }
      void loadRoadNetwork()
        .then(({ index, loadDurationMilliseconds, fileSizeBytes }) => {
          if (!effectActive) return;
          roadTracker = new RoadTracker(index);
          const currentPlayer =
            gameLoop?.getPlayer() ??
            runtimeFromTelemetry(useGameStore.getState().telemetry);
          roadContact = roadTracker.update([
            currentPlayer.longitude,
            currentPlayer.latitude,
          ]);
          roadNetworkEnabled = true;
          useGameStore.getState().setRoadNetworkStatus('ready');
          if (containerRef.current) {
            containerRef.current.dataset.roadNetworkStatus = 'ready';
            containerRef.current.dataset.roadLoadMs =
              loadDurationMilliseconds.toFixed(1);
            containerRef.current.dataset.roadFileBytes = String(fileSizeBytes);
          }
        })
        .catch(() => {
          if (!effectActive) return;
          roadNetworkEnabled = false;
          useGameStore.getState().setRoadNetworkStatus('unavailable');
          if (containerRef.current) {
            containerRef.current.dataset.roadNetworkStatus = 'unavailable';
          }
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
      removeLocationMarkers = addLocationMarkers(map);
      removeMissionRoute = addMissionRoute(
        map,
        deviceProfile.mapDataUpdateIntervalMilliseconds,
      );
      void addRoadDebugLayer(map)
        .then((removeLayer) => {
          if (effectActive) removeRoadDebugLayer = removeLayer;
          else removeLayer();
        })
        .catch(() => undefined);

      if (threeEnabled) {
        void import('../../map/threeLayer')
          .then(({ addThreeGameLayer }) => {
            if (!effectActive) return;
            try {
              threeLayer = addThreeGameLayer(map, {
                quality: deviceProfile.quality,
                reducedMotion: deviceProfile.reducedMotion,
                onPlayerReady: () => {
                  if (!effectActive) return;
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
                    setThreeResult({
                      profileKey: threeProfileKey,
                      status: 'fallback',
                    });
                  }
                },
              });
              threeLayer.updatePlayer(gameLoop?.getPlayer() ?? initialPlayer);
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

      const initialCamera = cameraForPlayer(initialPlayer);
      map.jumpTo(initialCamera);
      exposeCameraTarget(initialCamera);
      lastCameraUpdate = performance.now();
      lastFollowedLongitude = initialPlayer.longitude;
      lastFollowedLatitude = initialPlayer.latitude;
      lastFollowedHeading = initialPlayer.heading;
      lastFollowedSpeed = initialPlayer.speedMetersPerSecond;
      wasFollowing = useGameStore.getState().isFollowingPlayer;

      gameLoop = startPlayerGameLoop({
        initialPlayer,
        input: inputController,
        isPaused: () => useGameStore.getState().isPaused,
        getMovementOptions: () => ({
          steeringSensitivity: useSettingsStore.getState().steeringSensitivity,
          roadAssistMode: useSettingsStore.getState().roadAssistMode,
          roadAssistStrengthMultiplier: deviceProfile.isTouch
            ? roadAssistConfig.mobileStrengthMultiplier
            : 1,
          roadNetworkEnabled,
          roadContact,
          roadContactAt: roadTracker
            ? (runtime) => {
                roadContact =
                  roadTracker?.update([runtime.longitude, runtime.latitude]) ??
                  null;
                return roadContact ?? null;
              }
            : undefined,
          restrictedAreaTypeAt,
          driveEnabled: useGameStore.getState().vehicle.condition > 0,
        }),
        onVisualUpdate: (player, timestamp) => {
          visualFrameCount += 1;
          const frameSampleDuration = timestamp - lastFrameSampleTimestamp;
          if (frameSampleDuration >= 1_000 && containerRef.current) {
            containerRef.current.dataset.runtimeFps = (
              (visualFrameCount * 1_000) /
              frameSampleDuration
            ).toFixed(1);
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
            visualFrameCount = 0;
            lastFrameSampleTimestamp = timestamp;
          }
          playerMarker
            ?.setLngLat([player.longitude, player.latitude])
            .setRotation(player.heading);
          threeLayer?.updatePlayer(player);
          threeLayer?.setDrivingEffects({
            offroad: gameLoop?.getEnvironment().surface === 'offroad',
          });

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
          const speedChanged =
            Math.abs(player.speedMetersPerSecond - lastFollowedSpeed) >= 0.05;
          if (
            (!wasFollowing || positionChanged || speedChanged) &&
            timestamp - lastCameraUpdate >=
              deviceProfile.cameraUpdateIntervalMilliseconds
          ) {
            const camera = cameraForPlayer(player);
            const isRecentering = !wasFollowing;
            const duration = deviceProfile.reducedMotion
              ? 0
              : isRecentering
                ? followCameraConfig.recenterDurationMilliseconds
                : deviceProfile.cameraDurationMilliseconds;
            if (duration === 0) {
              map.jumpTo(camera);
            } else {
              map.easeTo({
                ...camera,
                duration,
                easing: isRecentering
                  ? (progress) => 1 - (1 - progress) ** 3
                  : (progress) => progress,
                essential: false,
              });
            }
            exposeCameraTarget(camera);
            recenterUntil = isRecentering ? timestamp + duration : 0;
            lastCameraUpdate = timestamp;
            lastFollowedLongitude = player.longitude;
            lastFollowedLatitude = player.latitude;
            lastFollowedHeading = player.heading;
            lastFollowedSpeed = player.speedMetersPerSecond;
          }
          wasFollowing = true;
        },
        onTelemetryUpdate: (player, movementSamples) => {
          const telemetryTimestamp = performance.now();
          const coordinates: [number, number] = [
            player.longitude,
            player.latitude,
          ];
          const state = useGameStore.getState();
          state.setTelemetry(player);
          if (roadTracker) {
            const metrics = roadTracker.getMetrics();
            if (containerRef.current) {
              containerRef.current.dataset.roadSearchMs =
                metrics.averageDurationMilliseconds.toFixed(3);
              containerRef.current.dataset.roadSearchCandidates = String(
                metrics.lastCandidateCount,
              );
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
              );
            }
            if (containerRef.current) {
              containerRef.current.dataset.roadSurface = environment.surface;
              containerRef.current.dataset.movementBlockedBy =
                environment.movementBlockedBy ?? '';
            }
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
              sample.input.interact,
              sample.deltaTimeSeconds,
            );
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
        if (threeLayer) syncInteractiveSignal(threeLayer);
        if (
          (!previousState.isPaused && state.isPaused) ||
          (!previousState.recoveryReason && state.recoveryReason) ||
          (!previousState.activeNarrativeEventId &&
            state.activeNarrativeEventId)
        ) {
          clearInterruptedInput();
        }
        if (
          state.playerRuntimeRevision === previousState.playerRuntimeRevision
        ) {
          return;
        }
        const restoredPlayer = runtimeFromTelemetry(state.telemetry);
        roadTracker?.reset();
        roadContact =
          roadTracker?.update([
            restoredPlayer.longitude,
            restoredPlayer.latitude,
          ]) ?? null;
        gameLoop?.replacePlayer(restoredPlayer);
        playerMarker
          ?.setLngLat([restoredPlayer.longitude, restoredPlayer.latitude])
          .setRotation(restoredPlayer.heading);
        const restoredCamera = cameraForPlayer(restoredPlayer);
        map.jumpTo(restoredCamera);
        exposeCameraTarget(restoredCamera);
        lastFollowedLongitude = restoredPlayer.longitude;
        lastFollowedLatitude = restoredPlayer.latitude;
        lastFollowedHeading = restoredPlayer.heading;
        lastFollowedSpeed = restoredPlayer.speedMetersPerSecond;
        wasFollowing = state.isFollowingPlayer;
        recenterUntil = 0;
      });

      setStatus('ready');
    };
    const handleManualCameraStart = (event: { originalEvent?: Event }) => {
      if (event.originalEvent) {
        useGameStore.getState().setFollowingPlayer(false);
      }
    };
    const handleResize = () => {
      const player = gameLoop?.getPlayer();
      if (!player || !useGameStore.getState().isFollowingPlayer) return;
      const camera = cameraForPlayer(player);
      map.jumpTo(camera);
      exposeCameraTarget(camera);
    };
    const handleError = (event: ErrorEvent) => {
      const message =
        event.error?.message ?? 'No fue posible cargar un recurso del mapa.';
      setErrorMessage(message);
      setStatus('error');
    };

    map.on('load', handleLoad);
    map.on('dragstart', handleManualCameraStart);
    map.on('zoomstart', handleManualCameraStart);
    map.on('rotatestart', handleManualCameraStart);
    map.on('pitchstart', handleManualCameraStart);
    map.on('error', handleError);
    window.addEventListener('resize', handleResize);
    map.setStyle(mapSourceConfig.styleUrl, {
      transformStyle: createStyleResourceTransform(window.location.href),
    });

    return () => {
      effectActive = false;
      map.off('load', handleLoad);
      map.off('dragstart', handleManualCameraStart);
      map.off('zoomstart', handleManualCameraStart);
      map.off('rotatestart', handleManualCameraStart);
      map.off('pitchstart', handleManualCameraStart);
      map.off('error', handleError);
      gameLoop?.stop();
      unsubscribeRuntime?.();
      unsubscribeSettings?.();
      removeLocationMarkers?.();
      removeMissionRoute?.();
      removeRoadDebugLayer?.();
      threeLayer?.remove();
      playerMarker?.remove();
      unbindKeyboard();
      window.removeEventListener('blur', clearInterruptedInput);
      window.removeEventListener('orientationchange', clearInterruptedInput);
      window.removeEventListener(CLEAR_GAME_INPUT_EVENT, clearInterruptedInput);
      window.removeEventListener('resize', handleResize);
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
  ]);

  return (
    <div
      className={`map-frame map-frame--${deviceProfile.quality} ${movementBlockedBy ? 'map-frame--movement-blocked' : ''}`}
      data-device-layout={deviceProfile.isCompact ? 'compact' : 'full'}
      data-player-renderer={threeStatus}
    >
      <div ref={containerRef} className="map-canvas" data-testid="game-map" />

      <div className="map-vignette" aria-hidden="true" />
      {ambientFog && <div className="map-atmosphere" aria-hidden="true" />}

      {status === 'loading' && (
        <div className="map-message" role="status">
          <span className="map-message__spinner" aria-hidden="true" />
          Desplegando cartografía local…
        </div>
      )}

      {status === 'ready' && (
        <span className="sr-only">El mapa local está listo.</span>
      )}

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
              : 'El mapa no pudo iniciar'}
          </strong>
          <span>
            {status === 'unsupported'
              ? 'Activa la aceleración gráfica o utiliza un navegador compatible.'
              : errorMessage}
          </span>
        </div>
      )}
    </div>
  );
}

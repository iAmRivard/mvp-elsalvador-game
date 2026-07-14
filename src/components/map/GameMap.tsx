import maplibregl, { type ErrorEvent } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TouchControls } from '../game/TouchControls';
import { gameConfig } from '../../config/game.config';
import { mapSourceConfig, mapViewConfig } from '../../config/map.config';
import { modelConfig } from '../../config/model.config';
import { missionById } from '../../data/missions';
import { detectDeviceProfile } from '../../game/deviceProfile';
import { distanceBetweenMeters } from '../../game/discovery';
import { startPlayerGameLoop, type PlayerGameLoop } from '../../game/gameLoop';
import {
  findDiscoverableLocations,
  findNearestLocation,
} from '../../game/discovery';
import { objectiveCoordinates } from '../../game/missions';
import { InputController } from '../../game/inputController';
import { addLocationMarkers } from '../../map/locationMarkers';
import { addMissionRoute } from '../../map/missionRoute';
import { createPlayerMarkerElement } from '../../map/playerMarker';
import { registerPmtilesProtocol } from '../../map/pmtilesProtocol';
import { createStyleResourceTransform } from '../../map/styleResources';
import type { ThreeGameLayerController } from '../../map/threeLayer';
import { shouldUseThreePlayer } from '../../map/threeTransforms';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { PlayerRuntime, PlayerTelemetry } from '../../types/game';

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
  const mission = missionById.get(modelConfig.interactiveMissionId);
  const objective = mission?.objectives.find(
    (candidate) => candidate.id === modelConfig.interactiveObjectiveId,
  );
  const coordinates = objective ? objectiveCoordinates(objective) : null;
  const visible =
    Boolean(coordinates) &&
    state.activeMissionId === mission?.id &&
    !state.activeMissionCompletedObjectiveIds.includes(
      objective?.id ?? modelConfig.interactiveObjectiveId,
    );

  if (!visible || !coordinates || !objective) {
    layer.setInteractiveSignal({ visible: false });
    return;
  }

  const distanceMeters = distanceBetweenMeters(
    [state.telemetry.longitude, state.telemetry.latitude],
    coordinates,
  );
  layer.setInteractiveSignal({
    visible: true,
    longitude: coordinates[0],
    latitude: coordinates[1],
    nearby: distanceMeters <= objective.radiusMeters,
  });
}

export function GameMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported] = useState(supportsWebGl);
  const [inputController] = useState(() => new InputController());
  const graphicsQuality = useSettingsStore((state) => state.graphicsQuality);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const ambientFog = useSettingsStore((state) => state.ambientFog);
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
    let unsubscribeRuntime: (() => void) | null = null;
    let lastCameraUpdate = 0;
    let lastFollowedLongitude = Number.NaN;
    let lastFollowedLatitude = Number.NaN;
    let lastFollowedHeading = Number.NaN;
    let wasFollowing = false;
    let effectActive = true;
    const unbindKeyboard = inputController.bindKeyboard(
      window,
      useGameStore.getState().togglePaused,
    );
    const clearInterruptedInput = () => inputController.clearPointerActions();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') clearInterruptedInput();
    };
    window.addEventListener('blur', clearInterruptedInput);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleLoad = () => {
      const initialPlayer = runtimeFromTelemetry(
        useGameStore.getState().telemetry,
      );
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

      map.jumpTo({
        center: [initialPlayer.longitude, initialPlayer.latitude],
        zoom: 11.4,
        pitch: Math.min(52, deviceProfile.maximumInitialPitch),
        bearing: initialPlayer.heading,
      });

      gameLoop = startPlayerGameLoop({
        initialPlayer,
        input: inputController,
        isPaused: () => useGameStore.getState().isPaused,
        onVisualUpdate: (player, timestamp) => {
          playerMarker
            ?.setLngLat([player.longitude, player.latitude])
            .setRotation(player.heading);
          threeLayer?.updatePlayer(player);

          const isFollowing = useGameStore.getState().isFollowingPlayer;
          if (!isFollowing) {
            wasFollowing = false;
            return;
          }

          const positionChanged =
            player.longitude !== lastFollowedLongitude ||
            player.latitude !== lastFollowedLatitude ||
            player.heading !== lastFollowedHeading;
          if (
            (!wasFollowing || positionChanged) &&
            timestamp - lastCameraUpdate >=
              deviceProfile.cameraUpdateIntervalMilliseconds
          ) {
            map.easeTo({
              center: [player.longitude, player.latitude],
              bearing: player.heading,
              duration: deviceProfile.cameraDurationMilliseconds,
              easing: (progress) => progress,
              essential: false,
            });
            lastCameraUpdate = timestamp;
            lastFollowedLongitude = player.longitude;
            lastFollowedLatitude = player.latitude;
            lastFollowedHeading = player.heading;
          }
          wasFollowing = true;
        },
        onTelemetryUpdate: (player) => {
          const coordinates: [number, number] = [
            player.longitude,
            player.latitude,
          ];
          const state = useGameStore.getState();
          state.setTelemetry(player);

          const nearestLocation = findNearestLocation(coordinates);
          state.setCurrentLocationId(nearestLocation?.id ?? null);

          const discoveries = findDiscoverableLocations(
            coordinates,
            state.discoveredLocationIds,
            state.unlockedLocationIds,
          );
          discoveries.forEach((location) =>
            useGameStore.getState().discoverLocation(location.id),
          );

          useGameStore
            .getState()
            .advanceActiveMission(player, inputController.snapshot().interact);
        },
      });

      unsubscribeRuntime = useGameStore.subscribe((state, previousState) => {
        if (threeLayer) syncInteractiveSignal(threeLayer);
        if (
          state.playerRuntimeRevision === previousState.playerRuntimeRevision
        ) {
          return;
        }
        const restoredPlayer = runtimeFromTelemetry(state.telemetry);
        gameLoop?.replacePlayer(restoredPlayer);
        playerMarker
          ?.setLngLat([restoredPlayer.longitude, restoredPlayer.latitude])
          .setRotation(restoredPlayer.heading);
        map.jumpTo({
          center: [restoredPlayer.longitude, restoredPlayer.latitude],
          bearing: restoredPlayer.heading,
          zoom: Math.max(map.getZoom(), 9.5),
        });
      });

      setStatus('ready');
    };
    const handleDragStart = () =>
      useGameStore.getState().setFollowingPlayer(false);
    const handleError = (event: ErrorEvent) => {
      const message =
        event.error?.message ?? 'No fue posible cargar un recurso del mapa.';
      setErrorMessage(message);
      setStatus('error');
    };

    map.on('load', handleLoad);
    map.on('dragstart', handleDragStart);
    map.on('error', handleError);
    map.setStyle(mapSourceConfig.styleUrl, {
      transformStyle: createStyleResourceTransform(window.location.href),
    });

    return () => {
      effectActive = false;
      map.off('load', handleLoad);
      map.off('dragstart', handleDragStart);
      map.off('error', handleError);
      gameLoop?.stop();
      unsubscribeRuntime?.();
      removeLocationMarkers?.();
      removeMissionRoute?.();
      threeLayer?.remove();
      playerMarker?.remove();
      unbindKeyboard();
      window.removeEventListener('blur', clearInterruptedInput);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      inputController.clearPointerActions();
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
      className={`map-frame map-frame--${deviceProfile.quality}`}
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

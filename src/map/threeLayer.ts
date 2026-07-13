import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map,
} from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GraphicsQuality } from '../config/game.config';
import { modelConfig } from '../config/model.config';
import type { PlayerRuntime } from '../types/game';
import {
  mercatorScaleForScreenSize,
  normalizedHeadingRadians,
  threePlayerTargetPixels,
  threeSignalTargetPixels,
} from './threeTransforms';

const PLAYER_MODEL_LENGTH = 4.7;
const SIGNAL_MODEL_HEIGHT = 6.5;

export interface InteractiveSignalState {
  visible: boolean;
  longitude?: number;
  latitude?: number;
  nearby?: boolean;
}

export interface ThreeGameLayerOptions {
  quality: GraphicsQuality;
  reducedMotion: boolean;
  onPlayerReady: () => void;
  onPlayerError: () => void;
}

export interface ThreeGameLayerController {
  updatePlayer: (player: PlayerRuntime) => void;
  setInteractiveSignal: (state: InteractiveSignalState) => void;
  remove: () => void;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mesh = child as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material | THREE.Material[]
    >;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      const materialProperties = material as unknown as Record<string, unknown>;
      for (const value of Object.values(materialProperties)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

class ThreeGameLayer implements CustomLayerInterface {
  readonly id = 'three-game-objects';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly loader = new GLTFLoader();
  private readonly options: ThreeGameLayerOptions;
  private map: Map | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private playerModel: THREE.Group | null = null;
  private signalModel: THREE.Group | null = null;
  private player: PlayerRuntime | null = null;
  private signal: InteractiveSignalState = { visible: false };
  private disposed = false;

  constructor(options: ThreeGameLayerOptions) {
    this.options = options;
  }

  onAdd(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: false,
      alpha: true,
    });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;

    const skyLight = new THREE.HemisphereLight(0xffe6bd, 0x17312e, 2.1);
    const sunLight = new THREE.DirectionalLight(0xffd38a, 3.2);
    sunLight.position.set(-3, -4, 8);
    this.scene.add(skyLight, sunLight);

    void this.loadPlayer();
    void this.loadSignal();
  }

  render(
    _gl: WebGLRenderingContext | WebGL2RenderingContext,
    input: CustomRenderMethodInput,
  ): void {
    if (!this.renderer || this.disposed) return;

    this.camera.projectionMatrix.fromArray(input.modelViewProjectionMatrix);
    this.camera.projectionMatrixInverse
      .copy(this.camera.projectionMatrix)
      .invert();
    this.applyScreenScales();
    this.animateSignal();

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (
      this.signal.visible &&
      !this.options.reducedMotion &&
      this.signalModel
    ) {
      this.map?.triggerRepaint();
    }
  }

  onRemove(): void {
    this.dispose();
  }

  updatePlayer(player: PlayerRuntime): void {
    const changed =
      !this.player ||
      this.player.longitude !== player.longitude ||
      this.player.latitude !== player.latitude ||
      this.player.heading !== player.heading;
    this.player = player;
    if (!changed) return;
    this.applyPlayerTransform();
    this.map?.triggerRepaint();
  }

  setInteractiveSignal(state: InteractiveSignalState): void {
    const changed =
      this.signal.visible !== state.visible ||
      this.signal.longitude !== state.longitude ||
      this.signal.latitude !== state.latitude ||
      this.signal.nearby !== state.nearby;
    this.signal = state;
    if (!changed) return;
    this.applySignalTransform();
    this.map?.triggerRepaint();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.playerModel) disposeObject(this.playerModel);
    if (this.signalModel) disposeObject(this.signalModel);
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  private async loadPlayer(): Promise<void> {
    try {
      const asset = await this.loader.loadAsync(modelConfig.playerVehicleUrl);
      if (this.disposed) {
        disposeObject(asset.scene);
        return;
      }
      this.playerModel = asset.scene;
      this.playerModel.name = 'vehiculo-3d-del-jugador';
      this.scene.add(this.playerModel);
      this.applyPlayerTransform();
      this.options.onPlayerReady();
      this.map?.triggerRepaint();
    } catch {
      if (!this.disposed) this.options.onPlayerError();
    }
  }

  private async loadSignal(): Promise<void> {
    try {
      const asset = await this.loader.loadAsync(
        modelConfig.interactiveSignalUrl,
      );
      if (this.disposed) {
        disposeObject(asset.scene);
        return;
      }
      this.signalModel = asset.scene;
      this.signalModel.name = 'baliza-3d-interactiva';
      this.scene.add(this.signalModel);
      this.applySignalTransform();
      this.map?.triggerRepaint();
    } catch {
      // La ruta y el indicador 2D siguen disponibles si la baliza falla.
    }
  }

  private applyPlayerTransform(): void {
    if (!this.player || !this.playerModel) return;
    const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
      [this.player.longitude, this.player.latitude],
      0,
    );
    this.playerModel.position.set(coordinate.x, coordinate.y, coordinate.z);
    this.playerModel.rotation.set(
      0,
      0,
      normalizedHeadingRadians(this.player.heading),
    );
    this.applyScreenScales();
  }

  private applySignalTransform(): void {
    if (!this.signalModel) return;
    this.signalModel.visible = this.signal.visible;
    if (
      !this.signal.visible ||
      this.signal.longitude === undefined ||
      this.signal.latitude === undefined
    ) {
      return;
    }
    const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
      [this.signal.longitude, this.signal.latitude],
      0,
    );
    this.signalModel.position.set(coordinate.x, coordinate.y, coordinate.z);
    this.applyScreenScales();
  }

  private applyScreenScales(): void {
    if (!this.map) return;
    const zoom = this.map.getZoom();
    if (this.playerModel) {
      const playerScale = mercatorScaleForScreenSize(
        zoom,
        threePlayerTargetPixels(this.options.quality),
        PLAYER_MODEL_LENGTH,
      );
      this.playerModel.scale.setScalar(playerScale);
    }
    if (this.signalModel) {
      const signalScale = mercatorScaleForScreenSize(
        zoom,
        threeSignalTargetPixels(this.options.quality),
        SIGNAL_MODEL_HEIGHT,
      );
      this.signalModel.scale.setScalar(signalScale);
    }
  }

  private animateSignal(): void {
    if (!this.signalModel?.visible) return;
    if (this.options.reducedMotion) {
      this.signalModel.rotation.z = 0;
      return;
    }
    const seconds = performance.now() / 1_000;
    this.signalModel.rotation.z = seconds * (this.signal.nearby ? 0.8 : 0.35);
  }
}

export function addThreeGameLayer(
  map: Map,
  options: ThreeGameLayerOptions,
): ThreeGameLayerController {
  const layer = new ThreeGameLayer(options);
  const firstLabelLayer = map
    .getStyle()
    .layers?.find((styleLayer) => styleLayer.type === 'symbol')?.id;
  map.addLayer(layer, firstLabelLayer);

  return {
    updatePlayer: (player) => layer.updatePlayer(player),
    setInteractiveSignal: (state) => layer.setInteractiveSignal(state),
    remove: () => {
      if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    },
  };
}

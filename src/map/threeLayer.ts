import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map,
} from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GraphicsQuality } from '../config/game.config';
import { modelConfig } from '../config/model.config';
import { chapterScenery, type SceneryKind } from '../data/scenery';
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

export interface ThreeDrivingEffectsState {
  offroad: boolean;
}

export interface ThreeGameLayerOptions {
  quality: GraphicsQuality;
  reducedMotion: boolean;
  onPlayerReady: () => void;
  onPlayerError: () => void;
}

export interface ThreeGameLayerController {
  updatePlayer: (player: PlayerRuntime) => void;
  setDrivingEffects: (state: ThreeDrivingEffectsState) => void;
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
  private sceneryGroup: THREE.Group | null = null;
  private brakeLights: THREE.Group | null = null;
  private dustCloud: THREE.Group | null = null;
  private brakeLightsUntil = 0;
  private drivingEffects: ThreeDrivingEffectsState = { offroad: false };
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
    this.addScenery();

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
    this.animateBrakeLights();
    this.animateDust();

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (
      (this.signal.visible &&
        !this.options.reducedMotion &&
        this.signalModel) ||
      this.brakeLightsUntil > performance.now() ||
      this.dustCloud?.visible
    ) {
      this.map?.triggerRepaint();
    }
  }

  onRemove(): void {
    this.dispose();
  }

  updatePlayer(player: PlayerRuntime): void {
    if (
      this.player &&
      Math.abs(this.player.speedMetersPerSecond) -
        Math.abs(player.speedMetersPerSecond) >
        0.8
    ) {
      this.brakeLightsUntil = performance.now() + 260;
    }
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

  setDrivingEffects(state: ThreeDrivingEffectsState): void {
    if (this.drivingEffects.offroad === state.offroad) return;
    this.drivingEffects = state;
    this.map?.triggerRepaint();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.playerModel) disposeObject(this.playerModel);
    if (this.signalModel) disposeObject(this.signalModel);
    if (this.sceneryGroup) disposeObject(this.sceneryGroup);
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
      this.addBrakeLights(this.playerModel);
      this.addDustCloud(this.playerModel);
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

  private addScenery(): void {
    const group = new THREE.Group();
    group.name = 'referencias-instanciadas-del-corredor';
    const definitions: Record<
      SceneryKind,
      {
        geometry: THREE.BufferGeometry;
        material: THREE.Material;
        height: number;
      }
    > = {
      tree: {
        geometry: new THREE.ConeGeometry(2.1, 7, 6),
        material: new THREE.MeshStandardMaterial({ color: 0x426846 }),
        height: 7,
      },
      post: {
        geometry: new THREE.BoxGeometry(0.18, 0.18, 2.8),
        material: new THREE.MeshStandardMaterial({ color: 0xd2b36c }),
        height: 2.8,
      },
      barrier: {
        geometry: new THREE.BoxGeometry(3.4, 0.32, 0.85),
        material: new THREE.MeshStandardMaterial({
          color: 0xb94e3e,
          emissive: 0x3b0d08,
        }),
        height: 0.85,
      },
      light: {
        geometry: new THREE.CylinderGeometry(0.11, 0.14, 4.2, 7),
        material: new THREE.MeshStandardMaterial({
          color: 0xe8d99f,
          emissive: 0x5f4c18,
          emissiveIntensity: 0.55,
        }),
        height: 4.2,
      },
      station: {
        geometry: new THREE.BoxGeometry(5.5, 4.2, 2.7),
        material: new THREE.MeshStandardMaterial({ color: 0x47685c }),
        height: 2.7,
      },
    };
    const transform = new THREE.Object3D();

    for (const kind of Object.keys(definitions) as SceneryKind[]) {
      const instances = chapterScenery.filter((item) => item.kind === kind);
      if (instances.length === 0) continue;
      const definition = definitions[kind];
      const mesh = new THREE.InstancedMesh(
        definition.geometry,
        definition.material,
        instances.length,
      );
      mesh.name = `escenario-${kind}`;
      instances.forEach((instance, index) => {
        const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
          instance.coordinates,
          0,
        );
        const scale = coordinate.meterInMercatorCoordinateUnits();
        transform.position.set(
          coordinate.x,
          coordinate.y,
          coordinate.z + (definition.height * scale) / 2,
        );
        transform.rotation.set(
          0,
          0,
          normalizedHeadingRadians(instance.heading),
        );
        transform.scale.setScalar(scale);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }
    this.sceneryGroup = group;
    this.scene.add(group);
  }

  private addBrakeLights(playerModel: THREE.Group): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0x7d0f0f,
      emissive: 0xff241c,
      emissiveIntensity: 2.2,
    });
    const geometry = new THREE.BoxGeometry(0.34, 0.12, 0.18);
    const group = new THREE.Group();
    for (const offset of [-0.72, 0.72]) {
      const light = new THREE.Mesh(geometry.clone(), material.clone());
      light.position.set(offset, 1.92, 0.72);
      group.add(light);
    }
    group.visible = false;
    group.name = 'luces-de-freno';
    playerModel.add(group);
    this.brakeLights = group;
  }

  private animateBrakeLights(): void {
    if (!this.brakeLights) return;
    this.brakeLights.visible = this.brakeLightsUntil > performance.now();
  }

  private addDustCloud(playerModel: THREE.Group): void {
    const group = new THREE.Group();
    group.name = 'polvo-fuera-de-carretera';
    group.position.set(0, 2.15, 0.28);
    for (let index = 0; index < 4; index += 1) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.32 + index * 0.06, 6, 4),
        new THREE.MeshBasicMaterial({
          color: 0xc6aa78,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        }),
      );
      particle.userData.phase = index / 4;
      group.add(particle);
    }
    group.visible = false;
    playerModel.add(group);
    this.dustCloud = group;
  }

  private animateDust(): void {
    if (!this.dustCloud) return;
    const speed = Math.abs(this.player?.speedMetersPerSecond ?? 0);
    const visible =
      this.drivingEffects.offroad && speed > 2 && !this.options.reducedMotion;
    this.dustCloud.visible = visible;
    if (!visible) return;
    const time = performance.now() / 1_000;
    this.dustCloud.children.forEach((particle, index) => {
      const phase = Number(particle.userData.phase ?? 0);
      const cycle = (time * 0.65 + phase) % 1;
      particle.position.set(
        Math.sin(time * 1.7 + index) * (0.3 + cycle * 0.7),
        cycle * 2.8,
        cycle * 0.7,
      );
      const scale = 0.7 + cycle * 1.4;
      particle.scale.setScalar(scale);
      const material = (particle as THREE.Mesh).material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = (1 - cycle) * 0.22;
      }
    });
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
    setDrivingEffects: (state) => layer.setDrivingEffects(state),
    setInteractiveSignal: (state) => layer.setInteractiveSignal(state),
    remove: () => {
      if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    },
  };
}

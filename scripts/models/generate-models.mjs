import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

class NodeFileReader {
  result = null;
  onloadend = null;

  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.({ target: this });
    });
  }

  readAsDataURL(blob) {
    void blob.arrayBuffer().then((buffer) => {
      const encoded = Buffer.from(buffer).toString('base64');
      this.result = `data:${blob.type};base64,${encoded}`;
      this.onloadend?.({ target: this });
    });
  }
}

globalThis.FileReader ??= NodeFileReader;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(scriptDirectory, '..', '..', 'public', 'models');

function standardMaterial(name, color, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: options.metalness ?? 0.05,
    roughness: options.roughness ?? 0.72,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
  material.name = name;
  return material;
}

function box(name, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  return mesh;
}

function cylinder(name, radius, length, position, material, segments = 12) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function createVehicle() {
  const vehicle = new THREE.Group();
  vehicle.name = 'vehiculo-expedicion';

  const ochre = standardMaterial('carroceria-ocre', 0xc89343, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const dark = standardMaterial('metal-oscuro', 0x202a2a, {
    metalness: 0.25,
    roughness: 0.68,
  });
  const glass = standardMaterial('vidrio-verde', 0x477c78, {
    metalness: 0.2,
    roughness: 0.28,
  });
  const light = standardMaterial('luz-calida', 0xffd276, {
    emissive: 0xd89222,
    emissiveIntensity: 1.3,
    roughness: 0.35,
  });

  vehicle.add(
    box('chasis', [2.25, 4.5, 0.62], [0, 0, 0.86], ochre),
    box('cabina', [1.78, 2.05, 0.9], [0, 0.35, 1.56], glass),
    box('techo', [1.95, 2.2, 0.18], [0, 0.38, 2.08], ochre),
    box('capo', [1.92, 1.25, 0.38], [0, -1.45, 1.27], ochre),
    box('parachoques-frontal', [2.35, 0.2, 0.25], [0, -2.3, 0.7], dark),
    box('parachoques-trasero', [2.35, 0.2, 0.25], [0, 2.3, 0.7], dark),
    box('faro-izquierdo', [0.42, 0.12, 0.24], [-0.65, -2.31, 1.12], light),
    box('faro-derecho', [0.42, 0.12, 0.24], [0.65, -2.31, 1.12], light),
  );

  for (const x of [-1.22, 1.22]) {
    for (const y of [-1.4, 1.42]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.38, 12),
        dark,
      );
      wheel.name = `rueda-${x}-${y}`;
      wheel.position.set(x, y, 0.57);
      wheel.rotation.z = Math.PI / 2;
      vehicle.add(wheel);
    }
  }

  for (const y of [-0.5, 1.15]) {
    vehicle.add(
      box('barra-portaequipaje', [2.05, 0.1, 0.1], [0, y, 2.24], dark),
    );
  }

  vehicle.userData = {
    asset: 'El Salvador: Rutas Perdidas',
    forwardAxis: '-Y',
    units: 'meters',
  };
  return vehicle;
}

function createSignalTower() {
  const signal = new THREE.Group();
  signal.name = 'baliza-suchitoto';

  const stone = standardMaterial('base-volcanica', 0x374442, {
    roughness: 0.9,
  });
  const metal = standardMaterial('estructura-bronce', 0xa66d2f, {
    metalness: 0.5,
    roughness: 0.42,
  });
  const glow = standardMaterial('senal-energetica', 0x7fe0cb, {
    emissive: 0x24bfa5,
    emissiveIntensity: 2.2,
    roughness: 0.25,
  });

  signal.add(
    cylinder('base', 1.45, 0.5, [0, 0, 0.25], stone, 10),
    cylinder('pedestal', 0.72, 1.0, [0, 0, 0.95], metal, 8),
    cylinder('mastil', 0.16, 4.6, [0, 0, 3.45], metal, 8),
  );

  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), glow);
  beacon.name = 'nucleo-de-senal';
  beacon.position.z = 5.9;
  signal.add(beacon);

  for (const [index, radius] of [0.85, 1.3, 1.75].entries()) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.08, 6, 24),
      glow,
    );
    ring.name = `onda-${index + 1}`;
    ring.position.z = 5.9;
    signal.add(ring);
  }

  for (const rotation of [0, Math.PI / 2]) {
    const brace = box('refuerzo', [0.12, 2.15, 0.12], [0, 0, 2.2], metal);
    brace.rotation.z = rotation;
    brace.rotation.x = 0.35;
    signal.add(brace);
  }

  signal.userData = {
    asset: 'El Salvador: Rutas Perdidas',
    interaction: 'investigar-senal',
    units: 'meters',
  };
  return signal;
}

async function exportGlb(object, outputName) {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(object, {
    binary: true,
    onlyVisible: true,
  });
  if (!(result instanceof ArrayBuffer)) {
    throw new TypeError(`La exportación de ${outputName} no produjo un GLB.`);
  }
  const bytes = new Uint8Array(result);
  await writeFile(join(outputDirectory, outputName), bytes);
  console.log(`${outputName}: ${(bytes.byteLength / 1024).toFixed(1)} KiB`);
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  exportGlb(createVehicle(), 'expedition-vehicle.glb'),
  exportGlb(createSignalTower(), 'suchitoto-signal.glb'),
]);

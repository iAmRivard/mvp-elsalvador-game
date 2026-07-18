import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [baselineDirectory, finalDirectory, outputPath] = process.argv.slice(2);
if (!baselineDirectory || !finalDirectory) {
  throw new Error(
    'Uso: node scripts/performance/compare-arcade-captures.mjs <baseline-dir> <final-dir> [output.json]',
  );
}

const metricsFileName = 'arcade-core-mobile-metrics.json';

async function metricsPaths(directory) {
  const found = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name === metricsFileName) found.push(path);
    }
  }
  await visit(resolve(directory));
  return found.sort();
}

async function loadGroup(directory, label) {
  const paths = await metricsPaths(directory);
  if (paths.length === 0) {
    throw new Error(`${label}: no se encontraron archivos ${metricsFileName}.`);
  }
  const captures = await Promise.all(
    paths.map(async (path) => ({
      path,
      metrics: JSON.parse(await readFile(path, 'utf8')),
    })),
  );
  const shas = new Set();
  for (const { path, metrics } of captures) {
    const metadata = metrics.captureMetadata ?? {};
    const { measuredSha, repositorySha, buildSha } = metadata;
    if (
      typeof repositorySha !== 'string' ||
      typeof buildSha !== 'string' ||
      repositorySha.length === 0 ||
      buildSha.length === 0 ||
      repositorySha !== buildSha ||
      measuredSha !== buildSha
    ) {
      throw new Error(`${label}: identidad repo/build inválida en ${path}.`);
    }
    shas.add(buildSha);
  }
  if (shas.size !== 1 || shas.has(null) || shas.has(undefined)) {
    throw new Error(
      `${label}: las corridas no comparten un SHA medido válido.`,
    );
  }
  return { captures, sha: [...shas][0] };
}

function contractFor(metrics) {
  const metadata = metrics.captureMetadata ?? {};
  return {
    schemaVersion: metadata.schemaVersion,
    browserName: metadata.browserName,
    browserVersion: metadata.browserVersion,
    userAgent: metrics.userAgent,
    viewport: metrics.viewport,
    deviceScaleFactor: metrics.deviceScaleFactor,
    buildMode: metadata.buildMode,
    performanceProfilingEnabled: metadata.performanceProfilingEnabled,
    diagnosticsEnabled: metadata.diagnosticsEnabled,
    scenario: metadata.scenario,
  };
}

function assertContract(group, label, expectedContract = null) {
  const first = contractFor(group.captures[0].metrics);
  if (first.schemaVersion !== 5) {
    throw new Error(`${label}: se requiere el contrato de captura schema 5.`);
  }
  const serialized = JSON.stringify(first);
  for (const capture of group.captures) {
    if (JSON.stringify(contractFor(capture.metrics)) !== serialized) {
      throw new Error(`${label}: contrato distinto en ${capture.path}.`);
    }
  }
  if (
    JSON.stringify(first.viewport) !== JSON.stringify(first.scenario?.viewport)
  ) {
    throw new Error(`${label}: viewport real y declarado no coinciden.`);
  }
  if (first.deviceScaleFactor !== first.scenario?.deviceScaleFactor) {
    throw new Error(`${label}: DPR real y declarado no coinciden.`);
  }
  if (expectedContract && serialized !== JSON.stringify(expectedContract)) {
    throw new Error(`${label}: el escenario no coincide con el baseline.`);
  }
  return first;
}

function captureSummary(metrics) {
  return {
    fpsThroughput: metrics.framesPerSecondThroughput,
    fpsInstantaneousAverage: metrics.instantaneousFramesPerSecond?.average,
    frameAverageMs: metrics.frameTimeMilliseconds?.average,
    frameP50Ms: metrics.frameTimeMilliseconds?.median,
    frameP95Ms: metrics.frameTimeMilliseconds?.p95,
    frameP99Ms: metrics.frameTimeMilliseconds?.p99,
    framesOver33Ms: metrics.frameTimeMilliseconds?.over33Milliseconds,
    framesOver50Ms: metrics.frameTimeMilliseconds?.over50Milliseconds,
    framesOver100Ms: metrics.frameTimeMilliseconds?.over100Milliseconds,
    longTasks: metrics.longTasks?.count,
    cameraAverageMs: metrics.cameraMilliseconds?.average,
    cameraP95Ms: metrics.cameraMilliseconds?.p95,
    cameraAppliedPerSecond: metrics.cameraCounterDeltas?.appliedPerSecond,
    roadTrackerP95Ms: metrics.roadTrackerMilliseconds?.p95,
    geoJsonUpdates: metrics.mapCounters?.geoJsonSourceUpdates,
    threePlayerUpdates: metrics.cameraCounterDeltas?.threePlayerUpdates,
    mobileHudRenders: metrics.renderDeltas?.mobileDrivingHud,
    heapFinalMb: metrics.memoryMegabytes?.final,
    target58Ms: metrics.timeToSelect58KphTargetMilliseconds,
    inputStoredMs: metrics.inputStoredLatencyMilliseconds,
    inputConsumedMs: metrics.inputConsumptionLatencyMilliseconds,
    usefulMapAreaRatio: Number(metrics.mapDataset?.usefulMapAreaRatio),
  };
}

function requiredFinite(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`carga dinamica: ${label} no es finito.`);
  }
  return value;
}

function distributionFor(values) {
  const counts = new Map();
  for (const value of values) {
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, count]) => [key, count / values.length]),
  );
}

function distributionDistance(first, second) {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  let difference = 0;
  for (const key of keys) {
    difference += Math.abs((first[key] ?? 0) - (second[key] ?? 0));
  }
  return difference / 2;
}

function coordinateDistanceMeters(first, second) {
  const radians = Math.PI / 180;
  const latitudeDelta = (second.latitude - first.latitude) * radians;
  const longitudeDelta = (second.longitude - first.longitude) * radians;
  const firstLatitude = first.latitude * radians;
  const secondLatitude = second.latitude * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(haversine));
}

function circularMeanDegrees(values) {
  const radians = Math.PI / 180;
  const sine = values.reduce(
    (total, value) => total + Math.sin(value * radians),
    0,
  );
  const cosine = values.reduce(
    (total, value) => total + Math.cos(value * radians),
    0,
  );
  return (Math.atan2(sine, cosine) / radians + 360) % 360;
}

function headingDistanceDegrees(first, second) {
  return Math.abs(((first - second + 540) % 360) - 180);
}

function dynamicLoadSummary(metrics, label) {
  const samples = metrics.dynamicLoad?.samples;
  if (!Array.isArray(samples) || samples.length < 80) {
    throw new Error(`carga dinamica: ${label} requiere al menos 80 muestras.`);
  }
  const normalized = samples.map((sample, index) => ({
    elapsedMilliseconds: requiredFinite(
      sample.elapsedMilliseconds,
      `${label}.samples[${String(index)}].elapsedMilliseconds`,
    ),
    longitude: requiredFinite(
      sample.longitude,
      `${label}.samples[${String(index)}].longitude`,
    ),
    latitude: requiredFinite(
      sample.latitude,
      `${label}.samples[${String(index)}].latitude`,
    ),
    speedKilometersPerHour: requiredFinite(
      sample.speedKilometersPerHour,
      `${label}.samples[${String(index)}].speedKilometersPerHour`,
    ),
    targetSpeedKilometersPerHour: requiredFinite(
      sample.targetSpeedKilometersPerHour,
      `${label}.samples[${String(index)}].targetSpeedKilometersPerHour`,
    ),
    headingDegrees: requiredFinite(
      sample.headingDegrees,
      `${label}.samples[${String(index)}].headingDegrees`,
    ),
    totalDistanceMeters: requiredFinite(
      sample.totalDistanceMeters,
      `${label}.samples[${String(index)}].totalDistanceMeters`,
    ),
    surface: String(sample.surface),
    selectedEdgeId:
      sample.selectedEdgeId === null || sample.selectedEdgeId === undefined
        ? 'none'
        : String(sample.selectedEdgeId),
    routeMode: String(sample.routeMode),
  }));
  for (let index = 1; index < normalized.length; index += 1) {
    if (
      normalized[index].elapsedMilliseconds <=
      normalized[index - 1].elapsedMilliseconds
    ) {
      throw new Error(
        `carga dinamica: ${label} no tiene tiempos estrictamente crecientes.`,
      );
    }
  }
  const first = normalized[0];
  const last = normalized.at(-1);
  const elapsedSpanMilliseconds =
    last.elapsedMilliseconds - first.elapsedMilliseconds;
  const expectedObservationMilliseconds = requiredFinite(
    metrics.observationMilliseconds,
    `${label}.observationMilliseconds`,
  );
  if (
    elapsedSpanMilliseconds < expectedObservationMilliseconds * 0.9 ||
    elapsedSpanMilliseconds > expectedObservationMilliseconds * 1.1
  ) {
    throw new Error(`carga dinamica: ${label} no cubre la ventana declarada.`);
  }
  const distanceDeltaMeters =
    last.totalDistanceMeters - first.totalDistanceMeters;
  if (distanceDeltaMeters <= 0) {
    throw new Error(`carga dinamica: ${label} no recorrió distancia.`);
  }
  return {
    sampleCount: normalized.length,
    elapsedSpanMilliseconds,
    averageSpeedKilometersPerHour:
      normalized.reduce(
        (total, sample) => total + sample.speedKilometersPerHour,
        0,
      ) / normalized.length,
    averageTargetSpeedKilometersPerHour:
      normalized.reduce(
        (total, sample) => total + sample.targetSpeedKilometersPerHour,
        0,
      ) / normalized.length,
    averageHeadingDegrees: circularMeanDegrees(
      normalized.map((sample) => sample.headingDegrees),
    ),
    distanceDeltaMeters,
    start: { longitude: first.longitude, latitude: first.latitude },
    end: { longitude: last.longitude, latitude: last.latitude },
    surfaces: distributionFor(normalized.map((sample) => sample.surface)),
    selectedEdges: distributionFor(
      normalized.map((sample) => sample.selectedEdgeId),
    ),
    routeModes: distributionFor(normalized.map((sample) => sample.routeMode)),
  };
}

function assertDynamicLoadsComparable(first, second, label) {
  const sampleDifference =
    Math.abs(first.sampleCount - second.sampleCount) /
    Math.max(first.sampleCount, second.sampleCount);
  const distanceDifference =
    Math.abs(first.distanceDeltaMeters - second.distanceDeltaMeters) /
    Math.max(1, first.distanceDeltaMeters, second.distanceDeltaMeters);
  if (
    sampleDifference > 0.1 ||
    Math.abs(first.elapsedSpanMilliseconds - second.elapsedSpanMilliseconds) >
      1_000 ||
    Math.abs(
      first.averageSpeedKilometersPerHour -
        second.averageSpeedKilometersPerHour,
    ) > 3 ||
    Math.abs(
      first.averageTargetSpeedKilometersPerHour -
        second.averageTargetSpeedKilometersPerHour,
    ) > 1 ||
    headingDistanceDegrees(
      first.averageHeadingDegrees,
      second.averageHeadingDegrees,
    ) > 3 ||
    distanceDifference > 0.1 ||
    coordinateDistanceMeters(first.start, second.start) > 5 ||
    coordinateDistanceMeters(first.end, second.end) > 100 ||
    distributionDistance(first.surfaces, second.surfaces) > 0.05 ||
    distributionDistance(first.selectedEdges, second.selectedEdges) > 0.15 ||
    distributionDistance(first.routeModes, second.routeModes) > 0.05
  ) {
    throw new Error(`carga dinamica: ${label} no es comparable.`);
  }
}

function assertDynamicLoadGroup(group, label) {
  const summaries = group.captures.map(({ metrics }, index) =>
    dynamicLoadSummary(metrics, `${label}[${String(index)}]`),
  );
  for (const summary of summaries.slice(1)) {
    assertDynamicLoadsComparable(summaries[0], summary, label);
  }
  return summaries;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function summarizeGroup(group, dynamicLoad) {
  const runs = group.captures.map(({ metrics }) => captureSummary(metrics));
  const keys = Object.keys(runs[0]);
  const aggregate = Object.fromEntries(
    keys.map((key) => {
      const values = runs.map((run) => run[key]).filter(Number.isFinite);
      return [
        key,
        {
          median: median(values),
          minimum: values.length ? Math.min(...values) : null,
          maximum: values.length ? Math.max(...values) : null,
        },
      ];
    }),
  );
  return {
    sha: group.sha,
    sampleCount: runs.length,
    runs,
    aggregate,
    dynamicLoad,
  };
}

const baseline = await loadGroup(baselineDirectory, 'baseline');
const final = await loadGroup(finalDirectory, 'final');
if (baseline.captures.length !== final.captures.length) {
  throw new Error(
    'Baseline y final deben tener la misma cantidad de muestras.',
  );
}
if (baseline.sha === final.sha) {
  throw new Error('Baseline y final deben representar SHA distintos.');
}
const contract = assertContract(baseline, 'baseline');
assertContract(final, 'final', contract);
const baselineDynamicLoad = assertDynamicLoadGroup(baseline, 'baseline');
const finalDynamicLoad = assertDynamicLoadGroup(final, 'final');
for (const baselineSummary of baselineDynamicLoad) {
  for (const finalSummary of finalDynamicLoad) {
    assertDynamicLoadsComparable(
      baselineSummary,
      finalSummary,
      'baseline/final',
    );
  }
}

const comparison = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  contract,
  baseline: summarizeGroup(baseline, baselineDynamicLoad),
  final: summarizeGroup(final, finalDynamicLoad),
};
const serialized = `${JSON.stringify(comparison, null, 2)}\n`;
if (outputPath) await writeFile(resolve(outputPath), serialized, 'utf8');
process.stdout.write(serialized);

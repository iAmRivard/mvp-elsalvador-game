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
  const shas = new Set(
    captures.map(({ metrics }) => metrics.captureMetadata?.measuredSha),
  );
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

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function summarizeGroup(group) {
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
  return { sha: group.sha, sampleCount: runs.length, runs, aggregate };
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

const comparison = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  contract,
  baseline: summarizeGroup(baseline),
  final: summarizeGroup(final),
};
const serialized = `${JSON.stringify(comparison, null, 2)}\n`;
if (outputPath) await writeFile(resolve(outputPath), serialized, 'utf8');
process.stdout.write(serialized);

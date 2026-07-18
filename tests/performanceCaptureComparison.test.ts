import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];
const comparator = resolve('scripts/performance/compare-arcade-captures.mjs');

function capture(
  repositorySha: string,
  buildSha = repositorySha,
  runtime = { roadNetworkStatus: 'ready', missionRouteMode: 'idle' },
  surface = 'trunk',
) {
  const viewport = { width: 392, height: 850 };
  return {
    captureMetadata: {
      schemaVersion: 5,
      measuredSha: buildSha,
      repositorySha,
      buildSha,
      browserName: 'chromium',
      browserVersion: 'test',
      buildMode: 'production-normal',
      performanceProfilingEnabled: false,
      diagnosticsEnabled: false,
      scenario: {
        id: 'arcade-core-trunk-cruise-v2',
        viewport,
        deviceScaleFactor: 2,
        ...runtime,
      },
    },
    userAgent: 'capture-contract-test',
    observationMilliseconds: 30_000,
    viewport,
    deviceScaleFactor: 2,
    dynamicLoad: {
      samples: Array.from({ length: 120 }, (_, index) => ({
        elapsedMilliseconds: index * 250,
        longitude: -89.2460003 - index * 0.00005,
        latitude: 13.8170917 + index * 0.000025,
        speedKilometersPerHour: 60,
        targetSpeedKilometersPerHour: 65,
        headingDegrees: 299.834,
        totalDistanceMeters: 1_250 + index * 4,
        surface,
        selectedEdgeId: surface === 'trunk' ? 9497 : null,
        routeMode: 'idle',
      })),
    },
  };
}

function fixtureDirectory(name: string, value: unknown): string {
  const root = mkdtempSync(join(tmpdir(), 'arcade-capture-'));
  temporaryDirectories.push(root);
  const directory = join(root, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'arcade-core-mobile-metrics.json'),
    JSON.stringify(value),
  );
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('contrato de capturas arcade', () => {
  it('acepta dos builds distintos cuando cada captura coincide con su checkout', () => {
    const baseline = fixtureDirectory('baseline', capture('a'.repeat(40)));
    const final = fixtureDirectory('final', capture('b'.repeat(40)));

    const comparison = JSON.parse(
      execFileSync(process.execPath, [comparator, baseline, final], {
        encoding: 'utf8',
      }),
    ) as { baseline: { sha: string }; final: { sha: string } };

    expect(comparison.baseline.sha).toBe('a'.repeat(40));
    expect(comparison.final.sha).toBe('b'.repeat(40));
  });

  it('rechaza un preview obsoleto aunque measuredSha coincida con el build', () => {
    const baseline = fixtureDirectory(
      'baseline',
      capture('a'.repeat(40), 'c'.repeat(40)),
    );
    const final = fixtureDirectory('final', capture('b'.repeat(40)));

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('identidad repo/build inválida');
  });

  it('rechaza comparar una ruta vial contra una captura fallback', () => {
    const baseline = fixtureDirectory('baseline', capture('a'.repeat(40)));
    const final = fixtureDirectory(
      'final',
      capture('b'.repeat(40), 'b'.repeat(40), {
        roadNetworkStatus: 'unavailable',
        missionRouteMode: 'fallback',
      }),
    );

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('escenario no coincide');
  });

  it('rechaza cargas dinamicas con superficies y trayectorias distintas', () => {
    const baseline = fixtureDirectory('baseline', capture('a'.repeat(40)));
    const final = fixtureDirectory(
      'final',
      capture(
        'b'.repeat(40),
        'b'.repeat(40),
        { roadNetworkStatus: 'ready', missionRouteMode: 'idle' },
        'offroad',
      ),
    );

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('carga dinamica');
  });
});

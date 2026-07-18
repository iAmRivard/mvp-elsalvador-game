import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];
const comparator = resolve('scripts/performance/compare-arcade-captures.mjs');
let captureIdentitySequence = 0;

function nextCapturedAt(): string {
  captureIdentitySequence += 1;
  return new Date(
    Date.UTC(2026, 6, 17, 0, 0, captureIdentitySequence),
  ).toISOString();
}

function capture(
  repositorySha: string,
  buildSha = repositorySha,
  runtime = { roadNetworkStatus: 'ready', missionRouteMode: 'idle' },
  surface = 'trunk',
  longitudeOffset = 0,
  performanceOverrides: {
    frameTimeMilliseconds?: Partial<{
      average: number;
      median: number;
      p95: number;
      p99: number;
      over33Milliseconds: number;
      over50Milliseconds: number;
      over100Milliseconds: number;
    }>;
    longTasks?: Partial<{ count: number }>;
    cameraMilliseconds?: Partial<{ average: number; p95: number }>;
  } = {},
) {
  const viewport = { width: 392, height: 850 };
  return {
    captureMetadata: {
      schemaVersion: 5,
      measuredSha: buildSha,
      repositorySha,
      buildSha,
      capturedAt: nextCapturedAt(),
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
    frameTimeMilliseconds: {
      average: 19,
      median: 16.7,
      p95: 33.3,
      p99: 33.4,
      over33Milliseconds: 200,
      over50Milliseconds: 0,
      over100Milliseconds: 0,
      ...performanceOverrides.frameTimeMilliseconds,
    },
    longTasks: {
      count: 0,
      ...performanceOverrides.longTasks,
    },
    cameraMilliseconds: {
      average: 1.5,
      p95: 2.4,
      ...performanceOverrides.cameraMilliseconds,
    },
    dynamicLoad: {
      samples: Array.from({ length: 120 }, (_, index) => ({
        elapsedMilliseconds: index * 250,
        longitude: -89.2460003 - index * 0.00005 + longitudeOffset,
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
  const values = Array.isArray(value)
    ? value
    : Array.from({ length: 3 }, () => {
        const copy = structuredClone(value) as {
          captureMetadata?: Record<string, unknown>;
        };
        copy.captureMetadata = {
          ...copy.captureMetadata,
          capturedAt: nextCapturedAt(),
        };
        return copy;
      });
  values.forEach((captureValue, index) => {
    const runDirectory = join(directory, `run-${String(index + 1)}`);
    mkdirSync(runDirectory, { recursive: true });
    writeFileSync(
      join(runDirectory, 'arcade-core-mobile-metrics.json'),
      JSON.stringify(captureValue),
    );
  });
  return directory;
}

function performanceCapture(
  sha: string,
  overrides: Parameters<typeof capture>[5] = {},
) {
  return capture(
    sha,
    sha,
    { roadNetworkStatus: 'ready', missionRouteMode: 'idle' },
    'trunk',
    0,
    overrides,
  );
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
    ) as {
      baseline: { sha: string };
      final: { sha: string };
      performanceGate: { status: string };
    };

    expect(comparison.baseline.sha).toBe('a'.repeat(40));
    expect(comparison.final.sha).toBe('b'.repeat(40));
    expect(comparison.performanceGate.status).toBe('passed');
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

  it('acepta una deriva menor de calentamiento sobre el mismo corredor', () => {
    const baseline = fixtureDirectory('baseline', capture('a'.repeat(40)));
    const final = fixtureDirectory(
      'final',
      capture(
        'b'.repeat(40),
        'b'.repeat(40),
        { roadNetworkStatus: 'ready', missionRouteMode: 'idle' },
        'trunk',
        0.00015,
      ),
    );

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
  });

  it('rechaza una trayectoria separada aunque conserve la superficie', () => {
    const baseline = fixtureDirectory('baseline', capture('a'.repeat(40)));
    const final = fixtureDirectory(
      'final',
      capture(
        'b'.repeat(40),
        'b'.repeat(40),
        { roadNetworkStatus: 'ready', missionRouteMode: 'idle' },
        'trunk',
        0.001,
      ),
    );

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('carga dinamica');
  });

  it.each([
    ['ausente', undefined],
    ['no finito', Number.NaN],
  ])('rechaza un frame p95 %s', (_label, p95) => {
    const baseline = fixtureDirectory(
      'baseline',
      performanceCapture('a'.repeat(40), {
        frameTimeMilliseconds: { p95 },
      }),
    );
    const final = fixtureDirectory('final', performanceCapture('b'.repeat(40)));

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('frameP95Ms');
  });

  it('requiere al menos tres corridas por grupo', () => {
    const baseline = fixtureDirectory('baseline', [
      performanceCapture('a'.repeat(40)),
      performanceCapture('a'.repeat(40)),
    ]);
    const final = fixtureDirectory('final', [
      performanceCapture('b'.repeat(40)),
      performanceCapture('b'.repeat(40)),
    ]);

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('al menos 3 corridas');
  });

  it('rechaza tres copias de la misma corrida', () => {
    const duplicatedBaseline = performanceCapture('a'.repeat(40));
    const baseline = fixtureDirectory('baseline', [
      duplicatedBaseline,
      duplicatedBaseline,
      duplicatedBaseline,
    ]);
    const final = fixtureDirectory('final', performanceCapture('b'.repeat(40)));

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('identidad de corrida duplicada');
  });

  it('acepta hasta 0.1 ms de margen cuantizado en frame p95', () => {
    const baseline = fixtureDirectory(
      'baseline',
      performanceCapture('a'.repeat(40)),
    );
    const final = fixtureDirectory(
      'final',
      performanceCapture('b'.repeat(40), {
        frameTimeMilliseconds: { p95: 33.4 },
      }),
    );

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
  });

  it('rechaza 0.2 ms de regresion en frame p95', () => {
    const baseline = fixtureDirectory(
      'baseline',
      performanceCapture('a'.repeat(40)),
    );
    const final = fixtureDirectory('final', [
      performanceCapture('b'.repeat(40)),
      performanceCapture('b'.repeat(40)),
      performanceCapture('b'.repeat(40), {
        frameTimeMilliseconds: { p95: 33.5 },
      }),
    ]);

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('frame p95');
  });

  it.each([
    ['frames >50 ms', { frameTimeMilliseconds: { over50Milliseconds: 1 } }],
    ['frames >100 ms', { frameTimeMilliseconds: { over100Milliseconds: 1 } }],
    ['long tasks', { longTasks: { count: 1 } }],
  ])('rechaza un aumento de %s', (_label, overrides) => {
    const baseline = fixtureDirectory(
      'baseline',
      performanceCapture('a'.repeat(40)),
    );
    const final = fixtureDirectory('final', [
      performanceCapture('b'.repeat(40)),
      performanceCapture('b'.repeat(40)),
      performanceCapture('b'.repeat(40), overrides),
    ]);

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('regresion');
  });

  it('acepta camera p95 menor a 3 ms', () => {
    const baseline = fixtureDirectory(
      'baseline',
      performanceCapture('a'.repeat(40)),
    );
    const final = fixtureDirectory(
      'final',
      performanceCapture('b'.repeat(40), {
        cameraMilliseconds: { p95: 2.999 },
      }),
    );

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
  });

  it('rechaza camera p95 igual a 3 ms', () => {
    const baseline = fixtureDirectory(
      'baseline',
      performanceCapture('a'.repeat(40)),
    );
    const final = fixtureDirectory('final', [
      performanceCapture('b'.repeat(40)),
      performanceCapture('b'.repeat(40)),
      performanceCapture('b'.repeat(40), {
        cameraMilliseconds: { p95: 3 },
      }),
    ]);

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('camera p95');
  });

  it('informa el aumento de frames >33 ms sin rechazar la comparacion', () => {
    const baseline = fixtureDirectory(
      'baseline',
      performanceCapture('a'.repeat(40)),
    );
    const final = fixtureDirectory(
      'final',
      performanceCapture('b'.repeat(40), {
        frameTimeMilliseconds: { over33Milliseconds: 201 },
      }),
    );

    const result = spawnSync(process.execPath, [comparator, baseline, final], {
      encoding: 'utf8',
    });
    const comparison = JSON.parse(result.stdout) as {
      performanceGate: { status: string; warnings: string[] };
    };

    expect(result.status).toBe(0);
    expect(comparison.performanceGate.status).toBe('passed');
    expect(comparison.performanceGate.warnings).toHaveLength(1);
  });
});

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  arcadeTraceCompletionTimeoutMilliseconds,
  arcadeTraceStartOptions,
  startArcadeTrace,
  stopArcadeTrace,
} from '../scripts/performance/cdp-trace-stream.mjs';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('stream CDP de rendimiento arcade', () => {
  it('captura timeline, compositor y GPU sin sampling', async () => {
    const send = vi.fn().mockResolvedValue({});

    await startArcadeTrace({ send });

    expect(send).toHaveBeenCalledWith('Tracing.start', arcadeTraceStartOptions);
    expect(arcadeTraceStartOptions.traceConfig.enableSampling).toBe(false);
    expect(arcadeTraceStartOptions.traceConfig.traceBufferSizeInKb).toBe(
      262_144,
    );
    expect(arcadeTraceCompletionTimeoutMilliseconds).toBe(60_000);
    expect(arcadeTraceStartOptions.traceConfig.includedCategories).toContain(
      'blink.user_timing',
    );
  });

  it('escribe el stream gzip sin convertirlo a texto', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'arcade-trace-'));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, 'trace.json.gz');
    const expected = Buffer.from([0x1f, 0x8b, 0x08, 0, 1, 2, 3, 4]);
    let tracingComplete:
      | ((event: { stream: string; dataLossOccurred: boolean }) => void)
      | undefined;
    let readCount = 0;
    const session = {
      once: vi.fn(
        (
          _event: string,
          listener: (event: {
            stream: string;
            dataLossOccurred: boolean;
          }) => void,
        ) => {
          tracingComplete = listener;
        },
      ),
      send: vi.fn((method: string) => {
        if (method === 'Tracing.end') {
          queueMicrotask(() =>
            tracingComplete?.({
              stream: 'trace-stream',
              dataLossOccurred: false,
            }),
          );
          return Promise.resolve({});
        }
        if (method === 'IO.read') {
          readCount += 1;
          return Promise.resolve(
            readCount === 1
              ? {
                  data: expected.toString('base64'),
                  base64Encoded: true,
                  eof: false,
                }
              : { data: '', eof: true },
          );
        }
        return Promise.resolve({});
      }),
    };

    const result = await stopArcadeTrace(session, outputPath);

    expect(await readFile(outputPath)).toEqual(expected);
    expect(result).toEqual({ bytesWritten: expected.length, outputPath });
    expect(session.send).toHaveBeenCalledWith('IO.close', {
      handle: 'trace-stream',
    });
  });

  it('falla con timeout acotado cuando Chrome no completa', async () => {
    const session = {
      once: vi.fn(),
      send: vi.fn().mockResolvedValue({}),
    };

    await expect(stopArcadeTrace(session, 'unused', 5)).rejects.toThrow('5 ms');
  });

  it('cierra el stream cuando Chrome reporta perdida', async () => {
    let tracingComplete:
      | ((event: { stream: string; dataLossOccurred: boolean }) => void)
      | undefined;
    const session = {
      once: vi.fn(
        (
          _event: string,
          listener: (event: {
            stream: string;
            dataLossOccurred: boolean;
          }) => void,
        ) => {
          tracingComplete = listener;
        },
      ),
      send: vi.fn((method: string) => {
        if (method === 'Tracing.end') {
          queueMicrotask(() =>
            tracingComplete?.({
              stream: 'lost-stream',
              dataLossOccurred: true,
            }),
          );
        }
        return Promise.resolve({});
      }),
    };

    await expect(stopArcadeTrace(session, 'unused')).rejects.toThrow('datos');
    expect(session.send).toHaveBeenCalledWith('IO.close', {
      handle: 'lost-stream',
    });
  });

  it('cierra archivo y stream cuando falla IO.read', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'arcade-trace-error-'));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, 'trace.json.gz');
    let tracingComplete:
      | ((event: { stream: string; dataLossOccurred: boolean }) => void)
      | undefined;
    const session = {
      once: vi.fn(
        (
          _event: string,
          listener: (event: {
            stream: string;
            dataLossOccurred: boolean;
          }) => void,
        ) => {
          tracingComplete = listener;
        },
      ),
      send: vi.fn((method: string) => {
        if (method === 'Tracing.end') {
          queueMicrotask(() =>
            tracingComplete?.({
              stream: 'broken-stream',
              dataLossOccurred: false,
            }),
          );
          return Promise.resolve({});
        }
        if (method === 'IO.read') {
          return Promise.reject(new Error('read failed'));
        }
        return Promise.resolve({});
      }),
    };

    await expect(stopArcadeTrace(session, outputPath)).rejects.toThrow(
      'read failed',
    );
    expect(session.send).toHaveBeenCalledWith('IO.close', {
      handle: 'broken-stream',
    });
    expect(await readFile(outputPath)).toHaveLength(0);
  });
});

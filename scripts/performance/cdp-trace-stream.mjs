import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';

export const arcadeTraceStartOptions = {
  transferMode: 'ReturnAsStream',
  streamFormat: 'json',
  streamCompression: 'gzip',
  tracingBackend: 'chrome',
  traceConfig: {
    recordMode: 'recordAsMuchAsPossible',
    traceBufferSizeInKb: 262_144,
    enableSampling: false,
    includedCategories: [
      'toplevel',
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'blink.user_timing',
      'v8.execute',
      'cc',
      'gpu',
    ],
  },
};

export const arcadeTraceCompletionTimeoutMilliseconds = 60_000;

export async function startArcadeTrace(session) {
  await session.send('Tracing.start', arcadeTraceStartOptions);
}

export async function stopArcadeTrace(
  session,
  outputPath,
  timeoutMilliseconds = arcadeTraceCompletionTimeoutMilliseconds,
) {
  let timeout;
  const completed = new Promise((resolve, reject) => {
    timeout = setTimeout(
      () =>
        reject(
          new Error(
            `Chrome no completó la traza arcade en ${String(timeoutMilliseconds)} ms.`,
          ),
        ),
      timeoutMilliseconds,
    );
    session.once('Tracing.tracingComplete', (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
  let completion;
  try {
    await session.send('Tracing.end');
    completion = await completed;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
  if (!completion.stream) {
    throw new Error('Chrome no entregó el stream de la traza arcade.');
  }
  if (completion.dataLossOccurred) {
    await session.send('IO.close', { handle: completion.stream });
    throw new Error('Chrome reportó pérdida de datos en la traza arcade.');
  }

  let bytesWritten = 0;
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    const file = await open(outputPath, 'w');
    try {
      let eof = false;
      while (!eof) {
        const chunk = await session.send('IO.read', {
          handle: completion.stream,
          size: 4 * 1_024 * 1_024,
        });
        const buffer = chunk.base64Encoded
          ? Buffer.from(chunk.data, 'base64')
          : Buffer.from(chunk.data);
        if (buffer.length > 0) {
          await file.write(buffer);
          bytesWritten += buffer.length;
        }
        eof = Boolean(chunk.eof);
      }
    } finally {
      await file.close();
    }
  } finally {
    await session.send('IO.close', { handle: completion.stream });
  }

  return { bytesWritten, outputPath };
}

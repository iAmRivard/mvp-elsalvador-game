export interface CdpSenderLike {
  send(
    method: string,
    parameters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

export interface CdpSessionLike extends CdpSenderLike {
  once(
    event: string,
    listener: (payload: Record<string, unknown>) => void,
  ): void;
}

export const arcadeTraceStartOptions: {
  transferMode: string;
  streamFormat: string;
  streamCompression: string;
  tracingBackend: string;
  traceConfig: {
    recordMode: string;
    traceBufferSizeInKb: number;
    enableSampling: boolean;
    includedCategories: string[];
  };
};

export const arcadeTraceCompletionTimeoutMilliseconds: number;

export function startArcadeTrace(session: CdpSenderLike): Promise<void>;

export function stopArcadeTrace(
  session: CdpSessionLike,
  outputPath: string,
  timeoutMilliseconds?: number,
): Promise<{ bytesWritten: number; outputPath: string }>;

export const diagnosticsEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DIAGNOSTICS === 'true';

export const performanceProfilingEnabled =
  import.meta.env.VITE_ENABLE_PROFILING === 'true';

export const performanceMetricsEnabled =
  diagnosticsEnabled || performanceProfilingEnabled;

function localAudioPath(path: string): string {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    !path.endsWith('.wav')
  ) {
    throw new Error(`Ruta de audio local inválida: ${path}`);
  }
  return path;
}

export const audioCueUrls = {
  engineIdle: localAudioPath('/audio/engine-idle.wav'),
  engineDrive: localAudioPath('/audio/engine-drive.wav'),
  offroad: localAudioPath('/audio/offroad.wav'),
  turbo: localAudioPath('/audio/turbo.wav'),
  brake: localAudioPath('/audio/brake.wav'),
  missionStart: localAudioPath('/audio/mission-start.wav'),
  objectiveComplete: localAudioPath('/audio/objective-complete.wav'),
  lowFuel: localAudioPath('/audio/low-fuel.wav'),
  discovery: localAudioPath('/audio/discovery.wav'),
  radioInterference: localAudioPath('/audio/radio-interference.wav'),
} as const;

export type AudioCue = keyof typeof audioCueUrls;

export const audioConfig = {
  defaultMasterVolume: 0.7,
  defaultEffectsVolume: 0.8,
  engineIdleMaximumGain: 0.24,
  engineDriveMaximumGain: 0.32,
  offroadMaximumGain: 0.2,
  reducedEffectsMultiplier: 0.35,
  parameterSmoothingSeconds: 0.12,
  turboThresholdRatio: 0.72,
  brakeDeltaRatio: 0.12,
  effectCooldownMilliseconds: 600,
} as const;

import {
  audioConfig,
  audioCueUrls,
  musicTrackUrls,
  type AudioCue,
  type MusicState,
  type MusicTrackId,
} from '../config/audio.config';

export interface AudioSettings {
  masterVolume: number;
  effectsVolume: number;
  musicVolume: number;
  muted: boolean;
  musicMuted: boolean;
  reducedEffects: boolean;
}

export interface VehicleAudioState {
  speedRatio: number;
  offroad: boolean;
  paused: boolean;
}

export interface AdaptiveMusicState {
  state: MusicState;
  radioActive: boolean;
  paused: boolean;
  timedIntensity: number;
}

interface LoopTrack {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

const vehicleLoopCues = ['engineIdle', 'engineDrive', 'offroad'] as const;
const musicTrackIds = Object.keys(musicTrackUrls) as MusicTrackId[];

function clampedRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function adaptiveMusicGainMultiplier(
  radioActive: boolean,
  paused: boolean,
): number {
  return (
    (radioActive ? audioConfig.musicRadioDuckMultiplier : 1) *
    (paused ? audioConfig.musicPausedMultiplier : 1)
  );
}

class LocalGameAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly vehicleLoops = new Map<
    (typeof vehicleLoopCues)[number],
    LoopTrack
  >();
  private readonly musicLoops = new Map<MusicTrackId, LoopTrack>();
  private readonly lastEffectAt = new Map<AudioCue, number>();
  private readonly pendingCues: AudioCue[] = [];
  private unlockPromise: Promise<void> | null = null;
  private settings: AudioSettings = {
    masterVolume: audioConfig.defaultMasterVolume,
    effectsVolume: audioConfig.defaultEffectsVolume,
    musicVolume: audioConfig.defaultMusicVolume,
    muted: false,
    musicMuted: false,
    reducedEffects: false,
  };
  private vehicle: VehicleAudioState = {
    speedRatio: 0,
    offroad: false,
    paused: true,
  };
  private music: AdaptiveMusicState = {
    state: 'silent',
    radioActive: false,
    paused: true,
    timedIntensity: 0,
  };

  configure(settings: AudioSettings): void {
    this.settings = {
      masterVolume: clampedRatio(settings.masterVolume),
      effectsVolume: clampedRatio(settings.effectsVolume),
      musicVolume: clampedRatio(settings.musicVolume),
      muted: settings.muted,
      musicMuted: settings.musicMuted,
      reducedEffects: settings.reducedEffects,
    };
    this.applySettings();
    this.applyVehicleMix();
    this.applyMusicMix();
  }

  unlock(): Promise<void> {
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockPromise = this.initialize().catch(() => this.shutdown());
    return this.unlockPromise;
  }

  updateVehicle(next: VehicleAudioState): void {
    const previous = this.vehicle;
    this.vehicle = {
      speedRatio: clampedRatio(next.speedRatio),
      offroad: next.offroad,
      paused: next.paused,
    };
    if (
      this.vehicle.speedRatio >= audioConfig.turboThresholdRatio &&
      previous.speedRatio < audioConfig.turboThresholdRatio
    ) {
      this.play('turbo');
    }
    if (
      previous.speedRatio - this.vehicle.speedRatio >=
        audioConfig.brakeDeltaRatio &&
      previous.speedRatio > 0.25
    ) {
      this.play('brake');
    }
    this.applyVehicleMix();
  }

  updateMusic(next: AdaptiveMusicState): void {
    const changed =
      next.state !== this.music.state ||
      next.radioActive !== this.music.radioActive ||
      next.paused !== this.music.paused ||
      next.timedIntensity !== this.music.timedIntensity;
    if (!changed) return;
    this.music = {
      state: next.state,
      radioActive: next.radioActive,
      paused: next.paused,
      timedIntensity: clampedRatio(next.timedIntensity),
    };
    this.applyMusicMix();
  }

  play(cue: AudioCue): void {
    const context = this.context;
    const buffer = this.buffers.get(cue);
    const effectsGain = this.effectsGain;
    if (!context || !buffer || !effectsGain || context.state !== 'running') {
      if (this.unlockPromise && this.pendingCues.length < 8) {
        this.pendingCues.push(cue);
      }
      return;
    }
    const now = performance.now();
    const lastPlayed = this.lastEffectAt.get(cue) ?? Number.NEGATIVE_INFINITY;
    if (now - lastPlayed < audioConfig.effectCooldownMilliseconds) return;
    this.lastEffectAt.set(cue, now);

    const source = context.createBufferSource();
    const gain = context.createGain();
    const isReducedEffect = ['turbo', 'brake', 'radioInterference'].includes(
      cue,
    );
    gain.gain.value =
      this.settings.reducedEffects && isReducedEffect
        ? audioConfig.reducedEffectsMultiplier
        : 1;
    source.buffer = buffer;
    source.connect(gain).connect(effectsGain);
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    });
    source.start();
  }

  shutdown(): void {
    for (const track of [
      ...this.vehicleLoops.values(),
      ...this.musicLoops.values(),
    ]) {
      try {
        track.source.stop();
      } catch {
        // La fuente puede haber terminado durante el cierre.
      }
    }
    this.vehicleLoops.clear();
    this.musicLoops.clear();
    this.buffers.clear();
    this.pendingCues.length = 0;
    void this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.effectsGain = null;
    this.musicGain = null;
    this.unlockPromise = null;
  }

  private async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;
    const context = new AudioContext();
    const masterGain = context.createGain();
    const effectsGain = context.createGain();
    const musicGain = context.createGain();
    effectsGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(context.destination);
    this.context = context;
    this.masterGain = masterGain;
    this.effectsGain = effectsGain;
    this.musicGain = musicGain;
    await context.resume();

    await Promise.all(
      [...Object.entries(audioCueUrls), ...Object.entries(musicTrackUrls)].map(
        async ([key, url]) => {
          const response = await fetch(url);
          if (!response.ok)
            throw new Error(`Audio local no disponible: ${url}`);
          this.buffers.set(
            key,
            await context.decodeAudioData(await response.arrayBuffer()),
          );
        },
      ),
    );
    for (const cue of vehicleLoopCues) this.startVehicleLoop(cue);
    for (const track of musicTrackIds) this.startMusicLoop(track);
    this.applySettings();
    this.applyVehicleMix();
    this.applyMusicMix();
    for (const cue of this.pendingCues.splice(0)) this.play(cue);
  }

  private startVehicleLoop(cue: (typeof vehicleLoopCues)[number]): void {
    const context = this.context;
    const effectsGain = this.effectsGain;
    const buffer = this.buffers.get(cue);
    if (!context || !effectsGain || !buffer || this.vehicleLoops.has(cue))
      return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain).connect(effectsGain);
    source.start();
    this.vehicleLoops.set(cue, { source, gain });
  }

  private startMusicLoop(trackId: MusicTrackId): void {
    const context = this.context;
    const musicGain = this.musicGain;
    const buffer = this.buffers.get(trackId);
    if (!context || !musicGain || !buffer || this.musicLoops.has(trackId))
      return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain).connect(musicGain);
    source.start();
    this.musicLoops.set(trackId, { source, gain });
  }

  private applySettings(): void {
    if (!this.context || !this.masterGain || !this.effectsGain) return;
    const now = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(
      this.settings.muted ? 0 : this.settings.masterVolume,
      now,
      audioConfig.parameterSmoothingSeconds,
    );
    this.effectsGain.gain.setTargetAtTime(
      this.settings.effectsVolume,
      now,
      audioConfig.parameterSmoothingSeconds,
    );
  }

  private applyVehicleMix(): void {
    const context = this.context;
    if (!context) return;
    const speed = this.vehicle.speedRatio;
    const active = this.vehicle.paused ? 0 : 1;
    const offroadMultiplier =
      this.settings.reducedEffects || !this.vehicle.offroad ? 0 : 1;
    const targets = {
      engineIdle:
        active *
        audioConfig.engineIdleMaximumGain *
        (0.25 + (1 - speed) * 0.75),
      engineDrive: active * audioConfig.engineDriveMaximumGain * speed,
      offroad:
        active * audioConfig.offroadMaximumGain * speed * offroadMultiplier,
    };
    for (const cue of vehicleLoopCues) {
      this.vehicleLoops
        .get(cue)
        ?.gain.gain.setTargetAtTime(
          targets[cue],
          context.currentTime,
          audioConfig.parameterSmoothingSeconds,
        );
    }
    this.vehicleLoops
      .get('engineDrive')
      ?.source.playbackRate.setTargetAtTime(
        0.75 + speed * 0.85,
        context.currentTime,
        audioConfig.parameterSmoothingSeconds,
      );
  }

  private applyMusicMix(): void {
    const context = this.context;
    const musicGain = this.musicGain;
    if (!context || !musicGain) return;
    const now = context.currentTime;
    const outputMultiplier = adaptiveMusicGainMultiplier(
      this.music.radioActive,
      this.music.paused,
    );
    musicGain.gain.setTargetAtTime(
      this.settings.musicMuted
        ? 0
        : this.settings.musicVolume * outputMultiplier,
      now,
      audioConfig.parameterSmoothingSeconds,
    );
    for (const trackId of musicTrackIds) {
      const parameter = this.musicLoops.get(trackId)?.gain.gain;
      if (!parameter) continue;
      const target =
        this.music.state === trackId
          ? trackId === 'timed'
            ? 0.72 + this.music.timedIntensity * 0.28
            : 1
          : 0;
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(parameter.value, now);
      parameter.linearRampToValueAtTime(
        target,
        now + audioConfig.musicCrossfadeSeconds,
      );
    }
  }
}

export const gameAudio = new LocalGameAudio();

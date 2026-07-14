import {
  audioConfig,
  audioCueUrls,
  type AudioCue,
} from '../config/audio.config';

export interface AudioSettings {
  masterVolume: number;
  effectsVolume: number;
  muted: boolean;
  reducedEffects: boolean;
}

export interface VehicleAudioState {
  speedRatio: number;
  offroad: boolean;
  paused: boolean;
}

interface LoopTrack {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

const loopCues = ['engineIdle', 'engineDrive', 'offroad'] as const;

function clampedRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

class LocalGameAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private readonly buffers = new Map<AudioCue, AudioBuffer>();
  private readonly loops = new Map<(typeof loopCues)[number], LoopTrack>();
  private readonly lastEffectAt = new Map<AudioCue, number>();
  private readonly pendingCues: AudioCue[] = [];
  private unlockPromise: Promise<void> | null = null;
  private settings: AudioSettings = {
    masterVolume: audioConfig.defaultMasterVolume,
    effectsVolume: audioConfig.defaultEffectsVolume,
    muted: false,
    reducedEffects: false,
  };
  private vehicle: VehicleAudioState = {
    speedRatio: 0,
    offroad: false,
    paused: true,
  };

  configure(settings: AudioSettings): void {
    this.settings = {
      masterVolume: clampedRatio(settings.masterVolume),
      effectsVolume: clampedRatio(settings.effectsVolume),
      muted: settings.muted,
      reducedEffects: settings.reducedEffects,
    };
    this.applySettings();
    this.applyVehicleMix();
  }

  unlock(): Promise<void> {
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockPromise = this.initialize().catch(() => {
      this.shutdown();
    });
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
    for (const track of this.loops.values()) track.source.stop();
    this.loops.clear();
    this.buffers.clear();
    this.pendingCues.length = 0;
    void this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.effectsGain = null;
    this.unlockPromise = null;
  }

  private async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;
    const context = new AudioContext();
    const masterGain = context.createGain();
    const effectsGain = context.createGain();
    effectsGain.connect(masterGain).connect(context.destination);
    this.context = context;
    this.masterGain = masterGain;
    this.effectsGain = effectsGain;
    await context.resume();

    await Promise.all(
      Object.entries(audioCueUrls).map(async ([cue, url]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Audio local no disponible: ${url}`);
        const buffer = await context.decodeAudioData(
          await response.arrayBuffer(),
        );
        this.buffers.set(cue as AudioCue, buffer);
      }),
    );
    for (const cue of loopCues) this.startLoop(cue);
    this.applySettings();
    this.applyVehicleMix();
    for (const cue of this.pendingCues.splice(0)) this.play(cue);
  }

  private startLoop(cue: (typeof loopCues)[number]): void {
    const context = this.context;
    const masterGain = this.masterGain;
    const buffer = this.buffers.get(cue);
    if (!context || !masterGain || !buffer || this.loops.has(cue)) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain).connect(masterGain);
    source.start();
    this.loops.set(cue, { source, gain });
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
    for (const cue of loopCues) {
      this.loops
        .get(cue)
        ?.gain.gain.setTargetAtTime(
          targets[cue],
          context.currentTime,
          audioConfig.parameterSmoothingSeconds,
        );
    }
    this.loops
      .get('engineDrive')
      ?.source.playbackRate.setTargetAtTime(
        0.75 + speed * 0.85,
        context.currentTime,
        audioConfig.parameterSmoothingSeconds,
      );
  }
}

export const gameAudio = new LocalGameAudio();

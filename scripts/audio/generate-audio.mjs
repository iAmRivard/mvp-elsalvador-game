import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDirectory = resolve(root, 'public/audio');
const sampleRate = 22_050;

function clampSample(value) {
  return Math.max(-1, Math.min(1, value));
}

function wavBuffer(durationSeconds, sampleAt) {
  const sampleCount = Math.round(durationSeconds * sampleRate);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const progress = index / Math.max(1, sampleCount - 1);
    buffer.writeInt16LE(
      Math.round(clampSample(sampleAt(time, progress)) * 32_767),
      44 + index * 2,
    );
  }
  return buffer;
}

function sine(frequency, time, phase = 0) {
  return Math.sin(Math.PI * 2 * frequency * time + phase);
}

function triangle(frequency, time) {
  return (2 / Math.PI) * Math.asin(sine(frequency, time));
}

function envelope(progress, attack = 0.08, release = 0.18) {
  return Math.min(1, progress / attack, (1 - progress) / release);
}

function noiseGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return (state / 0xffff_ffff) * 2 - 1;
  };
}

const offroadNoise = noiseGenerator(0x5a17);
let smoothedOffroadNoise = 0;
const rollingNoise = noiseGenerator(0x4d31);
let smoothedRollingNoise = 0;
const windNoise = noiseGenerator(0x7182);
let smoothedWindNoise = 0;
const turboNoise = noiseGenerator(0x7b04);
const brakeNoise = noiseGenerator(0x11c3);
const radioNoise = noiseGenerator(0x8790);
let smoothedRadioNoise = 0;

const sounds = [
  {
    name: 'engine-idle.wav',
    duration: 1,
    sample: (time) =>
      0.2 * sine(55, time) +
      0.1 * triangle(110, time) +
      0.035 * sine(7, time) * sine(165, time),
  },
  {
    name: 'engine-drive.wav',
    duration: 1,
    sample: (time) =>
      0.18 * triangle(92, time) +
      0.11 * sine(184, time) +
      0.05 * sine(276, time),
  },
  {
    name: 'rolling.wav',
    duration: 1,
    sample: (time) => {
      smoothedRollingNoise =
        smoothedRollingNoise * 0.84 + rollingNoise() * 0.16;
      return smoothedRollingNoise * 0.11 + 0.035 * sine(24, time);
    },
  },
  {
    name: 'wind.wav',
    duration: 1,
    sample: () => {
      smoothedWindNoise = smoothedWindNoise * 0.94 + windNoise() * 0.06;
      return smoothedWindNoise * 0.24;
    },
  },
  {
    name: 'offroad.wav',
    duration: 1,
    sample: (time) => {
      smoothedOffroadNoise =
        smoothedOffroadNoise * 0.72 + offroadNoise() * 0.28;
      return (
        smoothedOffroadNoise * 0.2 + 0.06 * triangle(18, time) * sine(95, time)
      );
    },
  },
  {
    name: 'turbo.wav',
    duration: 0.7,
    sample: (time, progress) =>
      envelope(progress, 0.05, 0.28) *
      (0.18 * sine(120 + progress * 520, time) + 0.1 * turboNoise()),
  },
  {
    name: 'brake.wav',
    duration: 0.45,
    sample: (time, progress) =>
      envelope(progress, 0.02, 0.45) *
      (0.12 * sine(850 - progress * 500, time) + 0.08 * brakeNoise()),
  },
  {
    name: 'mission-start.wav',
    duration: 0.9,
    sample: (time, progress) =>
      envelope(progress, 0.03, 0.2) *
      0.2 *
      (sine(220, time) + 0.7 * sine(277.18, time) + 0.5 * sine(329.63, time)),
  },
  {
    name: 'objective-complete.wav',
    duration: 0.65,
    sample: (time, progress) => {
      const frequency =
        progress < 0.33 ? 392 : progress < 0.66 ? 493.88 : 659.25;
      return envelope(progress, 0.02, 0.18) * 0.24 * sine(frequency, time);
    },
  },
  {
    name: 'low-fuel.wav',
    duration: 0.8,
    sample: (time, progress) => {
      const pulse =
        (progress > 0.08 && progress < 0.28) ||
        (progress > 0.52 && progress < 0.72);
      return pulse ? 0.2 * sine(440, time) : 0;
    },
  },
  {
    name: 'discovery.wav',
    duration: 0.8,
    sample: (time, progress) =>
      envelope(progress, 0.04, 0.25) *
      0.16 *
      (sine(261.63 + progress * 80, time) + sine(392 + progress * 120, time)),
  },
  {
    name: 'radio-interference.wav',
    duration: 1.4,
    sample: (time, progress) => {
      smoothedRadioNoise = smoothedRadioNoise * 0.5 + radioNoise() * 0.5;
      return (
        envelope(progress, 0.08, 0.25) *
        (0.14 * smoothedRadioNoise * (0.45 + 0.55 * Math.abs(sine(13, time))) +
          0.035 * sine(1_050, time))
      );
    },
  },
  {
    name: 'timer-warning.wav',
    duration: 0.35,
    sample: (time, progress) =>
      envelope(progress, 0.02, 0.25) *
      0.2 *
      (sine(660, time) + 0.45 * sine(990, time)),
  },
  {
    name: 'music-exploration.wav',
    duration: 12,
    sample: (time) => {
      const drift = 0.72 + 0.28 * sine(1 / 12, time);
      return (
        0.08 * sine(55, time) +
        0.05 * sine(82.5, time, Math.PI / 3) +
        0.035 * sine(110, time) * drift +
        0.025 * sine(165, time, Math.PI / 2)
      );
    },
  },
  {
    name: 'music-mission.wav',
    duration: 12,
    sample: (time) => {
      const pulse = 0.45 + 0.55 * Math.max(0, sine(1.5, time));
      return (
        0.075 * sine(55, time) +
        0.045 * sine(73.5, time, Math.PI / 4) +
        0.045 * triangle(110, time) * pulse +
        0.025 * sine(220, time) * (0.5 + 0.5 * sine(0.5, time))
      );
    },
  },
  {
    name: 'music-timed.wav',
    duration: 12,
    sample: (time) => {
      const pulse = Math.max(0, sine(2, time));
      const counterPulse = Math.max(0, sine(3, time, Math.PI / 2));
      return (
        0.07 * sine(49, time) +
        0.055 * triangle(98, time) * (0.35 + 0.65 * pulse) +
        0.04 * sine(196, time) * counterPulse +
        0.025 * sine(294, time, Math.PI / 3)
      );
    },
  },
];

await mkdir(outputDirectory, { recursive: true });
for (const sound of sounds) {
  await writeFile(
    resolve(outputDirectory, sound.name),
    wavBuffer(sound.duration, sound.sample),
  );
}

console.log(`Audio local generado: ${sounds.length} archivos en public/audio.`);

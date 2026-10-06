export type EffectSettings = {
  beauty: number;
  clarity: number;
  warmth: number;
  echo: number;
  reverb: number;
  delay: number;
  doubler: number;
  vocalVolume: number;
};

export type EffectPreset = {
  id: string;
  name: string;
  description: string;
  settings: EffectSettings;
};

const neutral: EffectSettings = {
  beauty: 0,
  clarity: 30,
  warmth: 25,
  echo: 0,
  reverb: 0,
  delay: 220,
  doubler: 0,
  vocalVolume: 85,
};

export const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: "reverb",
    name: "🌊 REVERB",
    description: "Clean karaoke vocal with an upfront sound and a clear room tail.",
    settings: { ...neutral, clarity: 38, warmth: 28, reverb: 56, vocalVolume: 88 },
  },
  {
    id: "studio",
    name: "🎙️ STUDIO",
    description: "Fuller vocal presence, smooth compression, and small-room ambience.",
    settings: {
      ...neutral,
      beauty: 56,
      clarity: 58,
      warmth: 34,
      reverb: 22,
      vocalVolume: 90,
    },
  },
  {
    id: "aor-1980s",
    name: "📼 AOR 1980'S",
    description: "Warm late-80s vocal with subtle centered doubling, a controlled echo, and plate ambience.",
    settings: {
      ...neutral,
      beauty: 36,
      clarity: 48,
      warmth: 56,
      echo: 42,
      reverb: 40,
      delay: 240,
      doubler: 18,
      vocalVolume: 88,
    },
  },
  {
    id: "sweet-echo",
    name: "💖 SWEET ECHO",
    description: "Warm romantic tone with smooth, clearly audible vocal repeats.",
    settings: {
      ...neutral,
      beauty: 38,
      clarity: 40,
      warmth: 48,
      echo: 40,
      reverb: 30,
      delay: 300,
      vocalVolume: 88,
    },
  },
];

const MAX_EFFECT_DURATION_SECONDS = 240;
const MAX_EFFECT_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_EFFECT_OUTPUT_BYTES = 50 * 1024 * 1024;
const MAX_CONSTRAINED_DURATION_SECONDS = 90;
const MAX_CONSTRAINED_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_CONSTRAINED_WORKING_BYTES = 160 * 1024 * 1024;
const MAX_DESKTOP_WORKING_BYTES = 512 * 1024 * 1024;

function getProcessingLimits() {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const hasCoarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const isConstrained =
    hasCoarsePointer ||
    (typeof navigator.hardwareConcurrency === "number" &&
      navigator.hardwareConcurrency <= 4) ||
    (deviceMemory !== undefined && deviceMemory <= 4);

  return {
    maxDurationSeconds: isConstrained
      ? MAX_CONSTRAINED_DURATION_SECONDS
      : MAX_EFFECT_DURATION_SECONDS,
    maxInputBytes: isConstrained
      ? MAX_CONSTRAINED_INPUT_BYTES
      : MAX_EFFECT_INPUT_BYTES,
    maxWorkingBytes: isConstrained
      ? MAX_CONSTRAINED_WORKING_BYTES
      : MAX_DESKTOP_WORKING_BYTES,
  };
}

function createReverbImpulse(context: OfflineAudioContext, amount: number) {
  const duration = 0.35 + amount * 2.5;
  const length = Math.ceil(context.sampleRate * duration);
  const impulse = context.createBuffer(1, length, context.sampleRate);
  const channel = impulse.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const decay = (1 - i / length) ** (2.4 - amount * 1.25);
    channel[i] = (Math.random() * 2 - 1) * decay;
  }
  return impulse;
}

function encodePcmWav(buffer: AudioBuffer) {
  const channels = Math.min(buffer.numberOfChannels, 2);
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataLength = frames * channels * bytesPerSample;
  const output = new ArrayBuffer(44 + dataLength);
  const view = new DataView(output);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);

  const sourceChannels = Array.from(
    { length: channels },
    (_, channel) => buffer.getChannelData(channel),
  );
  let peak = 0;
  for (const channel of sourceChannels) {
    for (let i = 0; i < frames; i += 1) {
      peak = Math.max(peak, Math.abs(channel[i]));
    }
  }
  const scale = peak > 0 ? 0.94 / peak : 1;
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, sourceChannels[channel][frame] * scale));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([output], { type: "audio/wav" });
}

export async function renderVocalEffects(
  recording: Blob,
  settings: EffectSettings,
): Promise<Blob> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    throw new Error("Effects Studio needs a supported browser. Your original recording is unchanged.");
  }
  const limits = getProcessingLimits();
  if (recording.size === 0 || recording.size > limits.maxInputBytes) {
    throw new Error(
      limits.maxInputBytes === MAX_CONSTRAINED_INPUT_BYTES
        ? "This device can safely process recordings up to 15 MB. Your original recording is unchanged; use a shorter recording or post the original."
        : "Choose a non-empty recording smaller than 50 MB to process.",
    );
  }
  if (typeof OfflineAudioContext === "undefined") {
    throw new Error("Audio effects are not supported by this browser. Your original recording is unchanged.");
  }

  const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(
    await recording.arrayBuffer(),
  );
  if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
    throw new Error("This recording could not be decoded. Your original recording is unchanged; retry or post the original.");
  }
  if (decoded.duration > limits.maxDurationSeconds) {
    const limit = limits.maxDurationSeconds === MAX_CONSTRAINED_DURATION_SECONDS
      ? "90 seconds on this device"
      : "4 minutes";
    throw new Error(`Effects Studio supports recordings up to ${limit}. Your original recording is unchanged; retry with a shorter recording or post the original.`);
  }
  if (decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2) {
    throw new Error("Effects Studio supports mono or stereo recordings only. Your original recording is unchanged; post the original instead.");
  }

  const sampleRate = Math.min(decoded.sampleRate, 48000);
  const channels = decoded.numberOfChannels;
  const echoTail = settings.echo > 0
    ? 1.2 + (settings.echo / 100) * 2.2
    : 0;
  const reverbTail = settings.reverb > 0
    ? 0.5 + (settings.reverb / 100) * 2.2
    : 0;
  const tailSeconds = Math.max(0.15, echoTail, reverbTail);
  const frames = Math.ceil((decoded.duration + tailSeconds) * sampleRate);
  const decodedBytes = decoded.length * decoded.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
  const renderedBytes = frames * channels * Float32Array.BYTES_PER_ELEMENT;
  const outputBytes = 44 + frames * channels * 2;
  const estimatedWorkingBytes =
    recording.size * 2 + decodedBytes + renderedBytes + outputBytes * 2;
  if (
    !Number.isSafeInteger(frames) ||
    estimatedWorkingBytes > limits.maxWorkingBytes ||
    outputBytes > MAX_EFFECT_OUTPUT_BYTES
  ) {
    throw new Error("This recording needs more memory than is safe for Effects Studio on this device. Your original recording is unchanged; retry with a shorter recording or post the original.");
  }

  const context = new OfflineAudioContext(channels, frames, sampleRate);
  const source = context.createBufferSource();
  source.buffer = decoded;

  const highPass = context.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 65;
  source.connect(highPass);

  const warmth = context.createBiquadFilter();
  warmth.type = "lowshelf";
  warmth.frequency.value = 240;
  warmth.gain.value = (settings.warmth / 100) * 3.5;
  highPass.connect(warmth);

  const clarity = context.createBiquadFilter();
  clarity.type = "peaking";
  clarity.frequency.value = 3400;
  clarity.Q.value = 0.8;
  clarity.gain.value = (settings.clarity / 100) * 4;
  warmth.connect(clarity);

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -12 - (settings.beauty / 100) * 8;
  compressor.knee.value = 10;
  compressor.ratio.value = 2 + (settings.beauty / 100) * 3;
  compressor.attack.value = 0.006;
  compressor.release.value = 0.18;
  clarity.connect(compressor);

  const master = context.createGain();
  master.gain.value = 0.65 + (settings.vocalVolume / 100) * 0.35;
  compressor.connect(master);
  master.connect(context.destination);

  if (settings.echo > 0) {
    const delay = context.createDelay(1);
    delay.delayTime.value = settings.delay / 1000;
    const feedback = context.createGain();
    feedback.gain.value = Math.min(0.4, (settings.echo / 100) * 0.44);
    const wet = context.createGain();
    wet.gain.value = (settings.echo / 100) * 0.5;
    clarity.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    delay.connect(feedback);
    feedback.connect(delay);
  }

  if (settings.reverb > 0) {
    const convolver = context.createConvolver();
    convolver.buffer = createReverbImpulse(context, settings.reverb / 100);
    const lowCut = context.createBiquadFilter();
    lowCut.type = "highpass";
    lowCut.frequency.value = 180;
    const wet = context.createGain();
    wet.gain.value = (settings.reverb / 100) * 0.44;
    clarity.connect(convolver);
    convolver.connect(lowCut);
    lowCut.connect(wet);
    wet.connect(master);
  }

  if (settings.doubler > 0) {
    const doubler = context.createDelay(0.05);
    doubler.delayTime.value = 0.018;
    const wet = context.createGain();
    wet.gain.value = (settings.doubler / 100) * 0.22;
    clarity.connect(doubler);
    doubler.connect(wet);
    wet.connect(master);
  }

  source.start();
  const rendered = await context.startRendering();
  const output = encodePcmWav(rendered);
  if (output.size > MAX_EFFECT_OUTPUT_BYTES) {
    throw new Error("The processed recording exceeds the 50 MB upload limit. Your original recording is unchanged.");
  }
  return output;
}

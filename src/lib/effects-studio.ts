export type EffectCategory = "signature" | "vocal" | "space";

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
  category: EffectCategory;
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

function preset(
  id: string,
  name: string,
  category: EffectCategory,
  description: string,
  settings: Partial<EffectSettings>,
): EffectPreset {
  return { id, name, category, description, settings: { ...neutral, ...settings } };
}

export const EFFECT_PRESETS: EffectPreset[] = [
  preset("studio-glow", "STUDIO GLOW", "signature", "Studio Beauty + Studio Echo", { beauty: 48, clarity: 42, warmth: 24, echo: 25, reverb: 12, delay: 240, vocalVolume: 88 }),
  preset("sweet-romance", "SWEET ROMANCE", "signature", "Sweet Vocal + Soft Echo + Light Reverb", { beauty: 30, clarity: 25, warmth: 48, echo: 20, reverb: 22, delay: 310, vocalVolume: 86 }),
  preset("pro-singer-signature", "PRO SINGER", "signature", "Pro Vocal + Plate Reverb + Studio Echo", { beauty: 38, clarity: 55, warmth: 20, echo: 25, reverb: 32, delay: 225, vocalVolume: 90 }),
  preset("80s-love", "80s LOVE", "signature", "80s Studio Vocal + 80s Echo + Plate Reverb", { beauty: 30, clarity: 45, warmth: 48, echo: 38, reverb: 40, delay: 370, doubler: 24, vocalVolume: 84 }),
  preset("dreamy-love", "DREAMY LOVE", "signature", "Warm Vocal + Dream Echo + Hall Reverb", { beauty: 26, clarity: 24, warmth: 62, echo: 34, reverb: 58, delay: 410, vocalVolume: 82 }),
  preset("crystal-dream", "CRYSTAL DREAM", "signature", "Crystal Voice + Dream Echo + Light Reverb", { beauty: 42, clarity: 78, warmth: 12, echo: 30, reverb: 30, delay: 360, vocalVolume: 88 }),
  preset("power-stage", "POWER STAGE", "signature", "Powerful Vocal + Big Stage + Echo", { beauty: 35, clarity: 55, warmth: 42, echo: 42, reverb: 62, delay: 280, vocalVolume: 94 }),
  preset("karaoke-pro", "KARAOKE PRO", "signature", "Karaoke Vocal + Classic Karaoke Echo + Room Reverb", { beauty: 42, clarity: 44, warmth: 28, echo: 35, reverb: 25, delay: 280, vocalVolume: 92 }),
  preset("sweet-studio", "SWEET STUDIO", "signature", "Sweet Vocal + Plate Reverb + Soft Echo", { beauty: 35, clarity: 35, warmth: 44, echo: 20, reverb: 45, delay: 310, vocalVolume: 87 }),
  preset("heavenly-voice", "HEAVENLY VOICE", "signature", "Warm Vocal + Heavenly Reverb + Dream Echo", { beauty: 24, clarity: 32, warmth: 62, echo: 30, reverb: 70, delay: 430, vocalVolume: 82 }),
  preset("retro-rock", "RETRO ROCK", "signature", "Warm Vocal + Slapback Echo + 80s Reverb", { beauty: 28, clarity: 50, warmth: 58, echo: 42, reverb: 42, delay: 115, doubler: 18, vocalVolume: 91 }),
  preset("ultimate-vocal", "ULTIMATE VOCAL", "signature", "Beauty + Clarity + Compression + Echo + Reverb", { beauty: 58, clarity: 62, warmth: 34, echo: 25, reverb: 28, delay: 250, vocalVolume: 90 }),

  preset("studio-beauty", "Studio Beauty", "vocal", "Gentle smoothing and controlled dynamics", { beauty: 55, clarity: 35, warmth: 25, vocalVolume: 88 }),
  preset("crystal-voice", "Crystal Voice", "vocal", "Bright, clear vocal presence", { beauty: 38, clarity: 78, warmth: 10, vocalVolume: 88 }),
  preset("warm-vocal", "Warm Vocal", "vocal", "Soft low-mid warmth", { beauty: 25, clarity: 25, warmth: 65, vocalVolume: 86 }),
  preset("pro-vocal", "Pro Vocal", "vocal", "Balanced clarity and gentle compression", { beauty: 45, clarity: 55, warmth: 25, vocalVolume: 92 }),
  preset("sweet-vocal", "Sweet Vocal", "vocal", "Smooth, soft vocal tone", { beauty: 46, clarity: 30, warmth: 48, vocalVolume: 87 }),
  preset("powerful-vocal", "Powerful Vocal", "vocal", "Presence and stronger level control", { beauty: 45, clarity: 58, warmth: 40, vocalVolume: 94 }),
  preset("smooth-vocal", "Smooth Vocal", "vocal", "Warmth with softened brightness", { beauty: 56, clarity: 22, warmth: 52, vocalVolume: 86 }),
  preset("80s-studio-vocal", "80s Studio Vocal", "vocal", "Bright retro tone with gentle doubling", { beauty: 35, clarity: 52, warmth: 48, doubler: 26, vocalVolume: 85 }),
  preset("beauty-clarity", "Beauty + Clarity", "vocal", "Polished tone with extra intelligibility", { beauty: 55, clarity: 65, warmth: 20, vocalVolume: 89 }),

  preset("studio-echo", "Studio Echo", "space", "Short controlled echo", { echo: 24, delay: 230 }),
  preset("classic-karaoke-echo", "Classic Karaoke Echo", "space", "Familiar rhythmic karaoke repeats", { echo: 42, delay: 290 }),
  preset("80s-echo", "80s Echo", "space", "Longer retro vocal repeats", { echo: 42, reverb: 22, delay: 380 }),
  preset("soft-echo", "Soft Echo", "space", "Subtle background repeats", { echo: 19, delay: 310 }),
  preset("deep-echo", "Deep Echo", "space", "Long, lower-feeling vocal space", { echo: 48, warmth: 25, delay: 480 }),
  preset("dream-echo", "Dream Echo", "space", "Floating, soft repeats", { echo: 34, reverb: 24, delay: 410 }),
  preset("slapback-echo", "Slapback Echo", "space", "Single short slap-style reflection", { echo: 35, delay: 105 }),
  preset("hall-reverb", "Hall Reverb", "space", "Large, smooth room tail", { reverb: 62 }),
  preset("plate-reverb", "Plate Reverb", "space", "Bright, even studio-style tail", { reverb: 44, clarity: 38 }),
  preset("room-reverb", "Room Reverb", "space", "Small natural room", { reverb: 22 }),
  preset("big-stage", "Big Stage", "space", "Wide stage-like space", { echo: 32, reverb: 65, delay: 325 }),
  preset("heavenly-reverb", "Heavenly Reverb", "space", "Long, soft ambient tail", { reverb: 75, warmth: 32 }),
];

export const DEFAULT_EFFECT_SETTINGS = { ...neutral };

const MAX_EFFECT_DURATION_SECONDS = 240;
const MAX_EFFECT_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_EFFECT_OUTPUT_BYTES = 50 * 1024 * 1024;

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
  const scale = peak > 0.94 ? 0.94 / peak : 1;
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
  if (recording.size === 0 || recording.size > MAX_EFFECT_INPUT_BYTES) {
    throw new Error("Choose a non-empty recording smaller than 50 MB to process.");
  }
  if (typeof OfflineAudioContext === "undefined") {
    throw new Error("Audio effects are not supported by this browser. Your original recording is unchanged.");
  }

  const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(
    await recording.arrayBuffer(),
  );
  if (decoded.duration > MAX_EFFECT_DURATION_SECONDS) {
    throw new Error("Effects Studio supports recordings up to 4 minutes. Your original recording is unchanged.");
  }

  const sampleRate = Math.min(decoded.sampleRate, 48000);
  const channels = Math.max(1, Math.min(decoded.numberOfChannels, 2));
  const echoTail = settings.echo > 0
    ? 1.2 + (settings.echo / 100) * 2.2
    : 0;
  const reverbTail = settings.reverb > 0
    ? 0.5 + (settings.reverb / 100) * 2.2
    : 0;
  const tailSeconds = Math.max(0.15, echoTail, reverbTail);
  const frames = Math.ceil((decoded.duration + tailSeconds) * sampleRate);
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
    feedback.gain.value = Math.min(0.42, (settings.echo / 100) * 0.46);
    const wet = context.createGain();
    wet.gain.value = (settings.echo / 100) * 0.42;
    clarity.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    delay.connect(feedback);
    feedback.connect(delay);
  }

  if (settings.reverb > 0) {
    const convolver = context.createConvolver();
    convolver.buffer = createReverbImpulse(context, settings.reverb / 100);
    const wet = context.createGain();
    wet.gain.value = (settings.reverb / 100) * 0.38;
    clarity.connect(convolver);
    convolver.connect(wet);
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

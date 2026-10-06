"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_EFFECT_SETTINGS,
  EFFECT_PRESETS,
  renderVocalEffects,
  type EffectCategory,
  type EffectPreset,
  type EffectSettings,
} from "@/lib/effects-studio";

type EffectsStudioProps = {
  recording: Blob;
  recordingUrl: string;
  onContinue: (recording: Blob) => void;
};

const categories: { id: EffectCategory; label: string }[] = [
  { id: "signature", label: "SIGNATURE" },
  { id: "vocal", label: "VOCAL" },
  { id: "space", label: "ECHO + REVERB" },
];

const sliders: { key: keyof EffectSettings; label: string; min: number; max: number; suffix?: string }[] = [
  { key: "beauty", label: "BEAUTY", min: 0, max: 100 },
  { key: "clarity", label: "CLARITY", min: 0, max: 100 },
  { key: "warmth", label: "WARMTH", min: 0, max: 100 },
  { key: "echo", label: "ECHO", min: 0, max: 70 },
  { key: "reverb", label: "REVERB", min: 0, max: 80 },
  { key: "delay", label: "DELAY", min: 50, max: 600, suffix: " ms" },
  { key: "doubler", label: "DOUBLER", min: 0, max: 60 },
  { key: "vocalVolume", label: "VOCAL VOLUME", min: 0, max: 100 },
];

export function EffectsStudio({
  recording,
  recordingUrl,
  onContinue,
}: EffectsStudioProps) {
  const [category, setCategory] = useState<EffectCategory>("signature");
  const [selectedPreset, setSelectedPreset] = useState<EffectPreset | null>(
    EFFECT_PRESETS[0],
  );
  const [settings, setSettings] = useState<EffectSettings>({
    ...EFFECT_PRESETS[0].settings,
  });
  const [rendered, setRendered] = useState<{ blob: Blob; url: string } | null>(
    null,
  );
  const [applied, setApplied] = useState(false);
  const [previewOriginal, setPreviewOriginal] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (rendered) URL.revokeObjectURL(rendered.url);
    };
  }, [rendered]);

  function selectPreset(preset: EffectPreset) {
    setSelectedPreset(preset);
    setSettings({ ...preset.settings });
    setRendered(null);
    setApplied(false);
    setError("");
    setPreviewOriginal(true);
  }

  function updateSetting(key: keyof EffectSettings, value: number) {
    setSettings((current) => ({ ...current, [key]: value }));
    setRendered(null);
    setApplied(false);
    setError("");
  }

  function reset() {
    setSettings({ ...DEFAULT_EFFECT_SETTINGS });
    setSelectedPreset(null);
    setCategory("signature");
    setRendered(null);
    setApplied(false);
    setError("");
    setPreviewOriginal(true);
  }

  async function previewEffect() {
    if (processing) return;
    setProcessing(true);
    setError("");
    setApplied(false);
    try {
      const blob = await renderVocalEffects(recording, settings);
      setRendered({ blob, url: URL.createObjectURL(blob) });
      setPreviewOriginal(false);
    } catch (reason: unknown) {
      setError(reason instanceof Error
        ? reason.message
        : "The effect preview failed. Your original recording is unchanged.");
    } finally {
      setProcessing(false);
    }
  }

  const visiblePresets = EFFECT_PRESETS.filter(
    (preset) => preset.category === category,
  );

  return (
    <section className="effects-studio" aria-labelledby="effects-studio-heading">
      <div className="effects-studio-heading">
        <div>
          <p className="eyebrow">YOUR ORIGINAL STAYS SAFE</p>
          <h2 id="effects-studio-heading">Vocal Effects Studio</h2>
        </div>
        <button className="effects-reset" disabled={processing} onClick={reset} type="button">RESET</button>
      </div>

      <div className="effects-categories" role="tablist" aria-label="Effect preset category">
        {categories.map((item) => (
          <button
            aria-selected={category === item.id}
            className={`effects-category${category === item.id ? " is-active" : ""}`}
            disabled={processing}
            key={item.id}
            onClick={() => setCategory(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="effects-presets">
        {visiblePresets.map((preset) => (
          <button
            aria-pressed={selectedPreset?.id === preset.id}
            className={`effects-preset${selectedPreset?.id === preset.id ? " is-selected" : ""}`}
            disabled={processing}
            key={preset.id}
            onClick={() => selectPreset(preset)}
            type="button"
          >
            <strong>{preset.name}</strong>
            <span>{preset.description}</span>
          </button>
        ))}
      </div>

      <div className="effects-controls">
        {sliders.map(({ key, label, min, max, suffix }) => (
          <label className="effects-control" key={key}>
            <span>{label}</span>
            <input
              max={max}
              min={min}
              disabled={processing}
              onChange={(event) => updateSetting(key, Number(event.target.value))}
              type="range"
              value={settings[key]}
            />
            <output>{settings[key]}{suffix ?? ""}</output>
          </label>
        ))}
      </div>

      <p className="effects-unavailable-control">
        Pitch/key adjustment isn’t available in this browser studio. Your original key is preserved.
      </p>

      <div className="effects-ab-controls">
        <button
          aria-pressed={previewOriginal}
          className={`button button-secondary${previewOriginal ? " is-selected" : ""}`}
          onClick={() => setPreviewOriginal(true)}
          type="button"
        >
          ▶ ORIGINAL
        </button>
        <button
          className="button button-secondary"
          disabled={processing}
          onClick={() => void previewEffect()}
          type="button"
        >
          {processing ? "RENDERING PREVIEW…" : "▶ PREVIEW EFFECT"}
        </button>
      </div>

      <audio
        aria-label={previewOriginal ? "Original recording preview" : "Effected recording preview"}
        controls
        controlsList="nodownload"
        src={previewOriginal || !rendered ? recordingUrl : rendered.url}
      />

      {error && <p className="effects-error" role="alert">{error}</p>}
      {applied && <p className="effects-success" role="status">Effect applied to a copy. Your original recording is preserved.</p>}

      <div className="effects-footer">
        <button className="button button-secondary" disabled={processing} onClick={reset} type="button">
          RESET
        </button>
        <button
          className="button button-play"
          disabled={!rendered || processing}
          onClick={() => setApplied(true)}
          type="button"
        >
          APPLY EFFECT
        </button>
        {applied && rendered && (
          <button
            className="button button-primary"
            onClick={() => onContinue(rendered.blob)}
            type="button"
          >
            CONTINUE TO POST
          </button>
        )}
        <button
          className="effects-use-original"
          onClick={() => onContinue(recording)}
          type="button"
        >
          POST ORIGINAL INSTEAD
        </button>
      </div>
    </section>
  );
}

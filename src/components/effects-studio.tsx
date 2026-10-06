"use client";

import { useEffect, useState } from "react";
import {
  EFFECT_PRESETS,
  renderVocalEffects,
  type EffectPreset,
} from "@/lib/effects-studio";

type EffectsStudioProps = {
  recording: Blob;
  recordingUrl: string;
  onContinue: (recording: Blob) => void;
};

export function EffectsStudio({
  recording,
  recordingUrl,
  onContinue,
}: EffectsStudioProps) {
  const [selectedPreset, setSelectedPreset] = useState<EffectPreset>(
    EFFECT_PRESETS[0],
  );
  const [settings, setSettings] = useState({
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

  async function renderEffect(apply: boolean) {
    if (processing) return;
    setProcessing(true);
    setError("");
    setApplied(false);
    try {
      const blob = await renderVocalEffects(recording, settings);
      setRendered({ blob, url: URL.createObjectURL(blob) });
      setPreviewOriginal(false);
      setApplied(apply);
    } catch (reason: unknown) {
      setError(reason instanceof Error
        ? reason.message
        : "The effect preview failed. Your original recording is unchanged.");
    } finally {
      setProcessing(false);
    }
  }

  function applyEffect() {
    if (rendered) {
      setApplied(true);
      setPreviewOriginal(false);
      return;
    }
    void renderEffect(true);
  }

  return (
    <section className="effects-studio" aria-labelledby="effects-studio-heading">
      <div className="effects-studio-heading">
        <div>
          <p className="eyebrow">YOUR ORIGINAL STAYS SAFE</p>
          <h2 id="effects-studio-heading">KEURAOKE EFFECTS 🎤</h2>
        </div>
      </div>

      <div className="effects-presets">
        {EFFECT_PRESETS.map((preset) => (
          <button
            aria-pressed={selectedPreset.id === preset.id}
            className={`effects-preset${selectedPreset.id === preset.id ? " is-selected" : ""}`}
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

      <div className="effects-ab-controls">
        <button
          aria-pressed={previewOriginal}
          className={`button button-secondary${previewOriginal ? " is-selected" : ""}`}
          onClick={() => setPreviewOriginal(true)}
          type="button"
        >
          ▶ PLAY ORIGINAL
        </button>
        <button
          className="button button-secondary"
          disabled={processing}
          onClick={() => void renderEffect(false)}
          type="button"
        >
          {processing ? "RENDERING PREVIEW…" : error ? "↻ RETRY PREVIEW" : "▶ PREVIEW EFFECT"}
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
        <button
          className="button button-play"
          disabled={processing}
          onClick={applyEffect}
          type="button"
        >
          {processing ? "PROCESSING EFFECT…" : "APPLY EFFECT"}
        </button>
        {applied && rendered && (
          <button
            className="button button-primary"
            onClick={() => onContinue(rendered.blob)}
            type="button"
          >
            SAVE RECORDING
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

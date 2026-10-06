"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EffectsStudio } from "@/components/effects-studio";
import { PostRecordDialog } from "@/components/socials/post-record-dialog";

type RecorderStatus = "ready" | "requesting" | "recording" | "recorded" | "error";
type AudioInput = {
  deviceId: string;
  label: string;
};

function microphoneErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Microphone access was denied. Allow microphone access in your browser or Android site settings, then try again.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No microphone is available. Connect a microphone or audio interface and check that your device can see it.";
    }
    if (error.name === "NotReadableError" || error.name === "AbortError") {
      return "The microphone is busy or unavailable. Close other apps using it, reconnect it, and try again.";
    }
  }
  return error instanceof Error
    ? `Recording could not start: ${error.message}`
    : "Recording could not start. Check microphone access and connected devices.";
}

function isNoiseReductionUnavailable(error: unknown) {
  return error instanceof DOMException &&
    error.name === "OverconstrainedError" &&
    "constraint" in error &&
    error.constraint === "noiseSuppression";
}

function isSelectedInputUnavailable(error: unknown) {
  return error instanceof DOMException &&
    (error.name === "NotFoundError" ||
      (error.name === "OverconstrainedError" &&
        (!("constraint" in error) || error.constraint === "deviceId")));
}

function selectRecordingType() {
  if (typeof MediaRecorder.isTypeSupported !== "function") return "";
  return [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

type PerformanceRecorderProps = {
  songTitle: string;
};

export function PerformanceRecorder({ songTitle }: PerformanceRecorderProps) {
  const [status, setStatus] = useState<RecorderStatus>("ready");
  const [message, setMessage] = useState("Your microphone audio is recorded directly without effects.");
  const [inputs, setInputs] = useState<AudioInput[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState("");
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [finalRecording, setFinalRecording] = useState<{
    blob: Blob;
    url: string;
  } | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingUrlRef = useRef("");
  const mountedRef = useRef(false);
  const inputDeviceIdRef = useRef("");
  const inputLostRef = useRef(false);

  const refreshInputs = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!mountedRef.current) return;
      const inputs = devices
        .filter((device) => device.kind === "audioinput")
        .map(({ deviceId, label }) => ({ deviceId, label }));
      setInputs(inputs);

      const selectedDeviceId = inputDeviceIdRef.current;
      if (selectedDeviceId && !inputs.some((input) => input.deviceId === selectedDeviceId)) {
        inputDeviceIdRef.current = "";
        setInputDeviceId("");
        inputLostRef.current = true;
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        setMessage("The selected microphone disconnected. The current recording is being finalized; the next recording will use the system default microphone.");
      }
    } catch (error: unknown) {
      console.error("Could not enumerate microphone inputs.", error);
      if (mountedRef.current) {
        setMessage("Microphone inputs could not be listed. You can still try the system-default microphone.");
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void Promise.resolve().then(refreshInputs);
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshInputs);

    return () => {
      mountedRef.current = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshInputs);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    };
  }, [refreshInputs]);

  useEffect(() => {
    return () => {
      if (finalRecording) URL.revokeObjectURL(finalRecording.url);
    };
  }, [finalRecording]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function deleteRecording() {
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = "";
    setRecordingUrl("");
    setRecordingBlob(null);
    setFinalRecording(null);
    setPostDialogOpen(false);
    setStatus("ready");
    inputLostRef.current = false;
    setMessage("Recording deleted.");
  }

  async function startRecording() {
    if (status === "requesting" || status === "recording") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("error");
      setMessage("This browser does not support microphone recording. Try a current Android Chrome or desktop browser over HTTPS.");
      return;
    }

    setStatus("requesting");
    setMessage("Waiting for microphone permission…");
    let stream: MediaStream;
    let usedDefaultFallback = false;
    let noiseReductionUnavailable = false;
    try {
      function requestInput(deviceId: string, useNoiseReduction: boolean) {
        return navigator.mediaDevices.getUserMedia({
          audio: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            noiseSuppression: useNoiseReduction,
            echoCancellation: false,
            autoGainControl: false,
          },
        });
      }

      async function requestWithNoiseFallback(deviceId: string) {
        try {
          return await requestInput(deviceId, noiseReduction);
        } catch (error: unknown) {
          if (!noiseReduction || !isNoiseReductionUnavailable(error)) throw error;
          noiseReductionUnavailable = true;
          return requestInput(deviceId, false);
        }
      }

      try {
        stream = await requestWithNoiseFallback(inputDeviceId);
      } catch (error: unknown) {
        if (!inputDeviceId || !isSelectedInputUnavailable(error)) throw error;
        inputDeviceIdRef.current = "";
        setInputDeviceId("");
        usedDefaultFallback = true;
        stream = await requestWithNoiseFallback("");
      }
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      setStatus("error");
      setMessage(usedDefaultFallback
        ? `The selected microphone is unavailable and the system default could not start: ${microphoneErrorMessage(error)}`
        : microphoneErrorMessage(error));
      return;
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      stream.getTracks().forEach((track) => track.stop());
      setStatus("error");
      setMessage("The selected device did not provide an audio input track.");
      return;
    }

    try {
      const mimeType = selectRecordingType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
      });
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      streamRef.current = stream;
      inputLostRef.current = false;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        stopStream();
        recorderRef.current = null;
        if (!mountedRef.current) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        if (blob.size === 0) {
          setStatus("error");
          setMessage("The recording was empty. Check the selected input and try again.");
          return;
        }
        const url = URL.createObjectURL(blob);
        if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
        recordingUrlRef.current = url;
        setRecordingBlob(blob);
        setFinalRecording(null);
        setRecordingUrl(url);
        setStatus("recorded");
        setMessage(inputLostRef.current
          ? "The selected microphone disconnected. Your recording up to that point is ready; the next recording will use the system default microphone."
          : "Recording ready. Play it back, delete it, or post it to KEURAOKE Socials.");
      }, { once: true });
      recorder.addEventListener("error", (event) => {
        stopStream();
        recorderRef.current = null;
        if (!mountedRef.current) return;
        setStatus("error");
        const detail = "error" in event && event.error instanceof Error
          ? ` ${event.error.message}`
          : "";
        setMessage(`Recording failed.${detail}`);
      }, { once: true });
      audioTrack.addEventListener("ended", () => {
        inputLostRef.current = true;
        if (recorder.state !== "inactive") recorder.stop();
        if (mountedRef.current) setMessage("Microphone input ended. The captured recording is being finalized.");
      }, { once: true });
      recorder.start();
      setStatus("recording");
      const inputMessage = usedDefaultFallback
        ? "The selected microphone disconnected; recording with the system default microphone."
        : "Recording microphone input only.";
      const noiseMessage = noiseReductionUnavailable
        ? " Noise reduction isn't available; your input is recorded without it."
        : "";
      setMessage(`${inputMessage}${noiseMessage} No effects or player audio are included.`);
      await refreshInputs();
    } catch (error: unknown) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setStatus("error");
      setMessage(error instanceof Error
        ? `Recording could not start: ${error.message}`
        : "Recording could not start with this microphone.");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    setMessage("Finishing your recording…");
  }

  return (
    <section className="performance-recorder" aria-labelledby="performance-recorder-heading">
      <div className="performance-recorder-heading">
        <div>
          <p className="eyebrow">PLAIN PERFORMANCE RECORDING</p>
          <h2 id="performance-recorder-heading">🎤 Record your performance</h2>
        </div>
        <span className={`performance-recorder-status performance-recorder-status-${status}`} aria-live="polite">
          {status === "recording" ? "🔴 RECORDING" : status === "requesting" ? "STARTING" : status === "error" ? "MIC UNAVAILABLE" : status === "recorded" ? "READY TO PLAY" : "READY"}
        </span>
      </div>

      <label className="performance-recorder-input">
        <span>MICROPHONE INPUT</span>
        <select
          disabled={status === "requesting" || status === "recording"}
          onChange={(event) => {
            inputDeviceIdRef.current = event.target.value;
            setInputDeviceId(event.target.value);
          }}
          value={inputDeviceId}
        >
          <option value="">🎤 System default microphone</option>
          {inputs.map((input) => (
            <option key={input.deviceId} value={input.deviceId}>
              {input.label || "Microphone (name available after permission)"}
            </option>
          ))}
        </select>
      </label>

      <label className="performance-recorder-noise-reduction">
        <input
          checked={noiseReduction}
          disabled={status === "requesting" || status === "recording"}
          onChange={(event) => setNoiseReduction(event.target.checked)}
          type="checkbox"
        />
        <span>NOISE REDUCTION</span>
        <strong>{noiseReduction ? "ON" : "OFF"}</strong>
        <small>Uses built-in microphone noise suppression when supported by your browser and device.</small>
      </label>

      <div className="performance-recorder-actions">
        <button
          className={`performance-recorder-record${status === "recording" ? " performance-recorder-stop" : ""}`}
          disabled={status === "requesting"}
          onClick={status === "recording" ? stopRecording : startRecording}
          type="button"
        >
          {status === "recording" ? "■ STOP" : status === "requesting" ? "STARTING…" : "🎤 RECORD"}
        </button>
        {recordingUrl && status !== "recording" && status !== "requesting" && (
          <>
            <audio aria-label="Play your recorded performance" controls controlsList="nodownload" src={recordingUrl} />
            <button className="performance-recorder-secondary" onClick={deleteRecording} type="button">
              🗑 DELETE
            </button>
          </>
        )}
      </div>
      {recordingBlob && recordingUrl && status === "recorded" && (
        <EffectsStudio
          onContinue={(blob) => {
            if (finalRecording) URL.revokeObjectURL(finalRecording.url);
            const url = URL.createObjectURL(blob);
            setFinalRecording({ blob, url });
            setPostDialogOpen(true);
          }}
          recording={recordingBlob}
          recordingUrl={recordingUrl}
        />
      )}
      <p className="performance-recorder-message" role={status === "error" ? "alert" : "status"}>
        {message}
      </p>
      <p className="performance-recorder-note">
        Your selected microphone is recorded directly. KEURAOKE does not apply effects, capture the YouTube player, or upload the recording automatically.
      </p>
      {postDialogOpen && finalRecording && (
        <PostRecordDialog
          onClose={() => setPostDialogOpen(false)}
          onPosted={() => {
            setPostDialogOpen(false);
            setMessage("Posted successfully! Your performance is now in KEURAOKE Socials.");
          }}
          recordingBlob={finalRecording.blob}
          recordingUrl={finalRecording.url}
          songTitle={songTitle}
        />
      )}
    </section>
  );
}

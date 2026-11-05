"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "starting" | "recording" | "unsupported" | "denied";

const MAX_MS = 45_000;
const SILENCE_MS = 1_800; // corta solo después de haber escuchado voz
const MIN_SPEECH_MS = 400;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return undefined;
}

/**
 * Graba el micrófono y corta solo cuando el usuario deja de hablar (o al tocar "Listo").
 * `start` debe llamarse dentro del toque del usuario (requisito de iOS).
 */
export function useRecorder(onAudio: (blob: Blob) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [level, setLevel] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef<number>(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelled = useRef(false);
  const onAudioRef = useRef(onAudio);
  useEffect(() => {
    onAudioRef.current = onAudio;
  });

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    ctx.current?.close().catch(() => {});
    ctx.current = null;
    setLevel(0);
  }, []);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    stop();
    cleanup();
    setState("idle");
  }, [stop, cleanup]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return false;
    }
    cancelled.current = false;
    setState("starting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setState("denied");
      return false;
    }
    const mime = pickMime();
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    r.onstop = () => {
      cleanup();
      setState("idle");
      if (!cancelled.current && chunks.length) onAudioRef.current(new Blob(chunks, { type: r.mimeType || mime || "audio/mp4" }));
    };
    rec.current = r;
    r.start(250);
    setState("recording");

    // Detección de silencio con el nivel de la señal.
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx.current = new AC();
      const analyser = ctx.current.createAnalyser();
      analyser.fftSize = 1024;
      ctx.current.createMediaStreamSource(stream.current).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let speechMs = 0;
      let quietSince = 0;
      let last = performance.now();
      const tick = (now: number) => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 6));
        const dt = now - last;
        last = now;
        if (rms > 0.035) {
          speechMs += dt;
          quietSince = 0;
        } else if (speechMs > MIN_SPEECH_MS) {
          quietSince ||= now;
          if (now - quietSince > SILENCE_MS) return stop();
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch {
      // Sin análisis de nivel: se corta con "Listo" o al llegar al máximo.
    }
    timers.current.push(setTimeout(stop, MAX_MS));
    return true;
  }, [cleanup, stop]);

  useEffect(() => () => cancel(), [cancel]);

  return { state, level, start, stop, cancel };
}
